import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialSaveState, validateSavePayload, normalizeLoadedSave, loadGameWithRecovery,
  persistAtomicSaveSafe, SAVE_STORAGE_KEY, SAVE_BACKUP_KEY, HISTORICAL_V2_BACKUP_KEY, QUARANTINE_KEY } from '../src/engine/saveManager';
import { createBaselineState, runSingleCampaign, StrategyId } from '../src/engine/campaignRunner';
import { computeQuotation, executeCommercialTransaction, resolveConsumableWear } from '../src/engine/economyEngine';
import { getDailyMarketContext } from '../src/engine/marketContext';
import { assembleTrapProduct, isTrapTriggeredByMass, simulateRegionExpedition, generatePeerCatalystCode, verifyAndParseCatalystCode } from '../src/engine/simulation';
import { TRAP_PARTS_CATALOG } from '../src/data/catalog';
import { claimSoloCatalyst } from '../src/engine/progression';

const terms = { priceMultiplier:1, warrantyBacked:false, exclusiveDeal:false, secretProvenance:false };
const strategies: StrategyId[] = ['BALANCED_MERCHANT','DUNGEON_LOYALIST','HERO_BENEFACTOR','ALCHEMICAL_INDUSTRIALIST','PREDATORY_CAPITALIST'];
class MemoryStorage {
  data = new Map<string,string>(); failAt = -1; writes = 0;
  getItem(k:string) { return this.data.get(k) ?? null; }
  setItem(k:string,v:string) { if (++this.writes === this.failAt) throw Error('interruption'); this.data.set(k,v); }
  removeItem(k:string) { this.data.delete(k); }
}
const fixture = (name:string) => fs.readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8').replace(/^\uFEFF/,'');
test('one independent fresh factory, no shared mutable arrays, all references resolve', () => {
  const a = createInitialSaveState(123), b = createBaselineState(123);
  assert.deepEqual(a,b); assert.equal(validateSavePayload(JSON.stringify(a)).valid,true);
  a.parties[0].members[0].massKg=1; assert.notDeepEqual(a,b);
  assert.equal(createInitialSaveState(123).parties[0].members[0].massKg,b.parties[0].members[0].massKg);
});
test('market stream persists through reload and ignores unrelated RNG/caller factor', () => {
  const s=createInitialSaveState(); const m=getDailyMarketContext(s.seed,s.day,s.activeRegion);
  assert.deepEqual(m,getDailyMarketContext(s.seed,s.day,s.activeRegion));
  assert.notDeepEqual(m,getDailyMarketContext(s.seed,s.day+1,s.activeRegion));
  const p=s.products.find(p=>p.targetAudience==='HERO')!, buyer=s.parties[0];
  const q=computeQuotation(p,buyer,'HERO',{...terms,seed:s.seed,day:s.day});
  const tx=executeCommercialTransaction(normalizeLoadedSave(s),'HERO',buyer.id,p,{...terms,marketSentiment:99} as any);
  assert.equal(tx.unitPrice,q.unitPrice); assert.deepEqual(tx.contract?.marketContext,m);
});
test('60 populated runner traces replay before daily clearing, including quote and full state', () => {
  let events=0;
  for(const strategy of strategies) for(let n=1;n<=12;n++) {
    let populated=0;
    runSingleCampaign(20260000+n,strategy,1,false,e=>{
      events++; populated++;
      const copy=structuredClone(e.before), p=copy.products.find(p=>p.id===e.productId)!;
      const buyer=(e.buyerType==='MASTER'?copy.masters:copy.parties).find(b=>b.id===e.buyerId)!;
      const q=computeQuotation(p,buyer,e.buyerType,{...e.terms,seed:copy.seed,day:copy.day,rulesVersion:copy.rulesVersion,unlockedSkills:copy.skills.filter(s=>s.unlocked).map(s=>s.effectKey)});
      const actual=executeCommercialTransaction(copy,e.buyerType,e.buyerId,p,e.terms);
      assert.deepEqual(actual,e.result);
      if(actual.success) { assert.equal(q.unitPrice,actual.unitPrice); assert(actual.nextState!.contractsToday.length>0); }
      assert.deepEqual(copy,e.before,'command mutates input');
    });
    assert(populated>0,`${strategy}/${n} had no actions`);
  }
  assert(events>=60);
});
test('actual v1 and historical Day5 v2 preserve progress; old backup recovers corrupt primary',()=>{
  for(const name of ['legacy-v1.json','historical-v2-day5.json']) {
    const raw=fixture(name), old=JSON.parse(raw), check=validateSavePayload(raw);
    assert.equal(check.valid,true,check.error); const next=check.state!;
    for(const key of ['day','gold','debt','contractHistory','financialLedger','catalystLedger','expertUnlocked','reagentInventory','partInventory'] as const) assert.deepEqual(next[key],old[key]);
    assert.deepEqual(next.products.filter(p=>old.products.some((o:any)=>o.id===p.id)),old.products);
    const st=new MemoryStorage();st.setItem(SAVE_STORAGE_KEY,'{broken');st.setItem(HISTORICAL_V2_BACKUP_KEY,raw);
    const loaded=loadGameWithRecovery(st as any);
    assert.equal(loaded.source,'HISTORICAL_V2_BACKUP');assert.equal(loaded.state.day,old.day);assert(loaded.notice?.includes(`Day ${old.day}`));
    assert.equal(st.getItem(HISTORICAL_V2_BACKUP_KEY),raw); assert.equal(st.getItem(QUARANTINE_KEY),'{broken');
    assert([...st.data.keys()].some(k=>k.startsWith('trap_and_tonic_pre_migration:')));
  }
});
test('nested corruption rejects atomically; healthy checkpoints survive interrupted writes',()=>{
  const good=createInitialSaveState();
  for(const damage of [(s:any)=>s.parties[0].members[0]=null,(s:any)=>delete s.parties[0].members[0].massKg,
    (s:any)=>delete s.products[0].counterClasses,(s:any)=>s.scheduledMatchups.cellar.partyId='missing',
    (s:any)=>s.products[0].stock=-1,(s:any)=>s.version='99',(s:any)=>s.skills[0].costPoints=0,(s:any)=>s.debt=Infinity]) {
    const bad=structuredClone(good);damage(bad); const st=new MemoryStorage();
    st.setItem(SAVE_STORAGE_KEY,JSON.stringify(bad));st.setItem(SAVE_BACKUP_KEY,JSON.stringify(good));
    assert.equal(validateSavePayload(JSON.stringify(bad)).valid,false);
    assert.equal(persistAtomicSaveSafe(bad,st as any),false);assert.equal(st.getItem(SAVE_BACKUP_KEY),JSON.stringify(good));
    assert.equal(loadGameWithRecovery(st as any).source,'BACKUP');
  }
  for(const failAt of [1,2]) {
    const st=new MemoryStorage();st.data.set(SAVE_STORAGE_KEY,JSON.stringify(good));st.failAt=failAt;
    assert.equal(persistAtomicSaveSafe({...good,gold:1000},st as any),false);
    assert.equal(loadGameWithRecovery(st as any).state.gold,good.gold);
  }
  const st=new MemoryStorage();st.setItem(SAVE_STORAGE_KEY,'bad');assert.equal(loadGameWithRecovery(st as any).writeBlocked,true);assert.equal(st.getItem(SAVE_STORAGE_KEY),'bad');
});
test('fifth dose and fourth installation rejected with zero mutation; repeated doses conserved',()=>{
  for(const kind of ['MASTER','HERO'] as const) {
    let s=createInitialSaveState(); const buyer=(kind==='MASTER'?s.masters:s.parties)[0];buyer.budget=99999;
    if(kind==='MASTER') s.masters[0].installedHazards=[];else s.parties[0].equippedProducts=[];
    const p=s.products.find(p=>p.targetAudience===kind)!;p.stock=10;
    const cap=kind==='MASTER'?3:4;
    for(let i=0;i<cap;i++) { const r=executeCommercialTransaction(s,kind,buyer.id,p,terms);assert(r.success,r.reason);s=r.nextState!; }
    const before=structuredClone(s), r=executeCommercialTransaction(s,kind,buyer.id,p,terms);
    assert.equal(r.success,false);assert.match(r.reason!,/full/);assert.deepEqual(s,before);assert.equal(s.contractHistory.length,cap);
    assert.equal(s.products.find(q=>q.id===p.id)!.stock,10-cap);
  }
});
test('wrong audience, stale/empty stock, unlocked other region and locked current region are atomic refusals',()=>{
  const s=createInitialSaveState();s.unlockedRegions.push('warrens'); const hero=s.products.find(p=>p.targetAudience==='HERO')!;
  for(const [kind,buyer,prod] of [['MASTER',s.masters[0].id,hero],['HERO',s.parties.find(p=>p.region==='warrens')!.id,hero],['HERO',s.parties[0].id,{...hero,id:'stale'}]] as const) {
    const before=structuredClone(s);assert.equal(executeCommercialTransaction(s,kind,buyer,prod,terms).success,false);assert.deepEqual(s,before);
  }
  hero.stock=0; assert.equal(executeCommercialTransaction(s,'HERO',s.parties[0].id,{...hero,stock:100},terms).success,false);
});
test('10 raids without purchases produce zero paid equipment, duplicate potions deplete individually',()=>{
  const s=createInitialSaveState(), p=s.parties[0],m=s.masters[0]; p.equippedProducts=[s.products[0].id,s.products[0].id];m.installedHazards=[];
  for(let d=1;d<=10;d++){const w=resolveConsumableWear(p,m,0,d,[]);p.equippedProducts=w.nextEquipped;m.installedHazards=w.nextInstalled;assert.equal(p.equippedProducts.length,Math.max(0,2-d));assert.equal(m.installedHazards.length,0);}
});
test('five actual runner policies, 50 no-purchase raids, zero phantom grants',()=>{
  for(const strategy of strategies) {
    const initial=createInitialSaveState();let last=initial;
    runSingleCampaign(initial.seed,strategy,10,false,undefined,{tradeEnabled:false,onAfterRaid:s=>{
      assert.equal(s.contractHistory.length,0);
      for(const m of s.masters) assert(m.installedHazards.length<=last.masters.find(p=>p.id===m.id)!.installedHazards.length);
      for(const p of s.parties) assert(p.equippedProducts.length<=last.parties.find(o=>o.id===p.id)!.equippedProducts.length);
      last=s;
    }});
    assert.equal(last.day,10);
  }
});
test('shared inversion predicate at 19/21/25/86kg and one paid persistent temporal rewind',()=>{
  const ids=['part_trg_12','part_con_01','part_del_01','part_pay_01','part_pow_01','part_rst_09'];
  const trap=assembleTrapProduct(ids.map(id=>TRAP_PARTS_CATALOG.find(p=>p.id===id)!) as any,'Temporal test',false);
  let s=createInitialSaveState();s.products.push(trap);s.masters[0].installedHazards=[];s.masters[0].installedResetCharges=[];s.masters[0].budget=99999;
  const tx=executeCommercialTransaction(s,'MASTER',s.masters[0].id,trap,terms);assert(tx.success,tx.reason);s=tx.nextState!;
  for(const mass of [19,21,25,86]) {
    assert.equal(isTrapTriggeredByMass(trap,mass),mass<25);
    const m={...s.masters[0],installedHazards:[trap.id]},p=structuredClone(s.parties[0]);p.equippedProducts=[];p.members[0].massKg=mass;
    const report=simulateRegionExpedition(3,s.seed,m,p,s.products,[]);
    assert.equal(report.rooms[0].outcome,mass<25?'TRAP_TRIGGERED':'TRAP_BYPASSED');
  }
  const m=s.masters[0];assert.deepEqual(m.installedResetCharges,[1]);
  const first=resolveConsumableWear(s.parties[0],m,0,3,[]);assert.equal(first.rewindsSpent,1);assert.deepEqual(first.nextInstalled,[trap.id]);
  m.installedHazards=first.nextInstalled;m.installedResetCharges=first.nextResetCharges;
  s=normalizeLoadedSave(s);assert.deepEqual(s.masters[0].installedResetCharges,[0]);
  const second=resolveConsumableWear(s.parties[0],s.masters[0],0,6,[]);assert.deepEqual(second.nextInstalled,[]);assert.deepEqual(second.nextResetCharges,[]);
});
test('community checksum is never authentic and cannot grant Expert, solo command requires actual bilateral work',()=>{
  const s=createInitialSaveState();s.unlockedRegions.push('warrens','blackspire');
  const c=verifyAndParseCatalystCode(generatePeerCatalystCode('MERCHANT',9),9,[],s.unlockedRegions);
  assert(c.valid);assert.equal(c.entry!.isAuthentic,false);assert.equal(claimSoloCatalyst(s),s);
  for(const strategy of ['DUNGEON_LOYALIST','HERO_BENEFACTOR'] as StrategyId[]) {
    const r=runSingleCampaign(20260001,strategy,120);assert.equal(r.finalState.expertUnlocked,false,'specialist peer bypass must not unlock Expert');
  }
});
