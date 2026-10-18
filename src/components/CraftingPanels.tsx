import { isTrapTriggeredByMass } from '../engine/simulation';
import React, { useState, useMemo } from 'react';
import {
  Reagent,
  TrapPart,
  CraftedProduct,
  RegionId,
  ReagentSlotRole,
  TrapSlotRole
} from '../types/game';
import { REAGENTS_CATALOG, TRAP_PARTS_CATALOG } from '../data/catalog';
import { synthesizeAlchemyProduct, assembleTrapProduct } from '../engine/simulation';

interface AlchemyLabProps {
  gold: number;
  unlockedRegions: RegionId[];
  reagentInventory: Record<string, number>;
  chelateSkillUnlocked: boolean;
  bonusYieldUnlocked: boolean;
  onBrewProduct: (product: CraftedProduct, cost: number, consumedIds: string[], batchSize: number) => void;
  onBuyReagent: (reagent: Reagent, qty: number) => void;
}

export const AlchemyLabPanel: React.FC<AlchemyLabProps> = ({
  gold,
  unlockedRegions,
  reagentInventory,
  chelateSkillUnlocked,
  bonusYieldUnlocked,
  onBrewProduct,
  onBuyReagent
}) => {
  const availableReagents = useMemo(
    () => REAGENTS_CATALOG.filter((r) => unlockedRegions.includes(r.regionOrigin)),
    [unlockedRegions]
  );

  const bases = availableReagents.filter((r) => r.role === 'base');
  const actives = availableReagents.filter((r) => r.role === 'active');
  const carriers = availableReagents.filter((r) => r.role === 'carrier');
  const stabilisers = availableReagents.filter((r) => r.role === 'stabiliser');
  const catalysts = availableReagents.filter((r) => r.role === 'catalyst');

  const [baseId, setBaseId] = useState(bases[1]?.id || bases[0].id);
  const [activeId, setActiveId] = useState(actives[0].id);
  const [carrierId, setCarrierId] = useState(carriers[1]?.id || carriers[0].id);
  const [stabiliserId, setStabiliserId] = useState(stabilisers[0].id);
  const [catalystId, setCatalystId] = useState(catalysts[0].id);
  const [customName, setCustomName] = useState('');
  const [marketFilter, setMarketFilter] = useState<ReagentSlotRole | 'all'>('all');

  const selectedTuple = useMemo((): [Reagent, Reagent, Reagent, Reagent, Reagent] => {
    const b = REAGENTS_CATALOG.find((r) => r.id === baseId) || bases[0];
    const a = REAGENTS_CATALOG.find((r) => r.id === activeId) || actives[0];
    const c = REAGENTS_CATALOG.find((r) => r.id === carrierId) || carriers[0];
    const s = REAGENTS_CATALOG.find((r) => r.id === stabiliserId) || stabilisers[0];
    const k = REAGENTS_CATALOG.find((r) => r.id === catalystId) || catalysts[0];
    return [b, a, c, s, k];
  }, [baseId, activeId, carrierId, stabiliserId, catalystId, bases, actives, carriers, stabilisers, catalysts]);

  const previewProduct = useMemo(
    () => synthesizeAlchemyProduct(selectedTuple, customName, chelateSkillUnlocked),
    [selectedTuple, customName, chelateSkillUnlocked]
  );

  const loadPreset = (preset: 'unstabilised_antidote' | 'chelated_antidote' | 'chicken_morph' | 'charcoal_breather' | 'rust_solvent') => {
    if (preset === 'unstabilised_antidote') {
      setBaseId('reg_base_02');
      setActiveId('reg_act_01');
      setCarrierId('reg_car_02');
      setStabiliserId('reg_stb_01');
      setCatalystId('reg_cat_01');
      setCustomName('Standard Basilisk Antidote (Unstabilised)');
    } else if (preset === 'chelated_antidote') {
      setBaseId('reg_base_02');
      setActiveId('reg_act_01');
      setCarrierId(unlockedRegions.includes('warrens') ? 'reg_car_05' : 'reg_car_02');
      setStabiliserId(unlockedRegions.includes('warrens') ? 'reg_stb_03' : 'reg_stb_02');
      setCatalystId('reg_cat_02');
      setCustomName('Quartz-Chelated Basilisk Antidote');
    } else if (preset === 'chicken_morph') {
      setBaseId(unlockedRegions.includes('warrens') ? 'reg_base_06' : 'reg_base_02');
      setActiveId('reg_act_02');
      setCarrierId(unlockedRegions.includes('warrens') ? 'reg_car_04' : 'reg_car_02');
      setStabiliserId('reg_stb_02');
      setCatalystId(unlockedRegions.includes('warrens') ? 'reg_cat_04' : 'reg_cat_01');
      setCustomName('Bantam Chicken-Morph Draught');
    } else if (preset === 'charcoal_breather') {
      setBaseId('reg_base_02');
      setActiveId(unlockedRegions.includes('warrens') ? 'reg_act_06' : 'reg_act_04');
      setCarrierId(unlockedRegions.includes('warrens') ? 'reg_car_05' : 'reg_car_03');
      setStabiliserId('reg_stb_02');
      setCatalystId('reg_cat_01');
      setCustomName('Charcoal Alchemical Breather Tonic');
    } else if (preset === 'rust_solvent') {
      setBaseId(unlockedRegions.includes('warrens') ? 'reg_base_03' : 'reg_base_04');
      setActiveId(unlockedRegions.includes('warrens') ? 'reg_act_08' : 'reg_act_03');
      setCarrierId(unlockedRegions.includes('warrens') ? 'reg_car_06' : 'reg_car_03');
      setStabiliserId('reg_stb_01');
      setCatalystId(unlockedRegions.includes('warrens') ? 'reg_cat_03' : 'reg_cat_01');
      setCustomName('Rust-Monster Gear Solvent Bomb');
    }
  };

  // Calculate missing reagent cost if not in stock
  const missingCost = selectedTuple.reduce((acc, r) => {
    const have = reagentInventory[r.id] || 0;
    return acc + (have > 0 ? 0 : r.baseCost);
  }, 0);

  const batchUnits = bonusYieldUnlocked ? 3 : 2;

  const handleSynthesize = () => {
    if (gold < missingCost) return;
    onBrewProduct(
      previewProduct,
      missingCost,
      selectedTuple.map((r) => r.id),
      batchUnits
    );
    setCustomName('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 Cols: 5-Slot Alchemy Reaction Bench */}
      <div className="lg:col-span-7 bg-[#131822] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-800">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-100">
                01. Five-Slot Alchemical Reaction Bench
              </h2>
              <p className="text-xs text-slate-400">
                Combine Base + Active Reagent + Carrier + Stabiliser + Catalyst. Traits interact deterministically.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 tabular-nums">
              {availableReagents.length} / 48 Reagents Unlocked
            </span>
          </div>

          {/* Formula Quick-Presets for Double-Sale Chains */}
          <div className="mb-5">
            <p className="text-xs font-mono text-slate-400 mb-2">Load Canonical Formula Template:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadPreset('chelated_antidote')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Quartz-Chelated Antidote (Sulphur Immune)
              </button>
              <button
                onClick={() => loadPreset('chicken_morph')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Bantam Chicken-Morph (-65kg Mass)
              </button>
              <button
                onClick={() => loadPreset('charcoal_breather')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Charcoal Sulphur Breather
              </button>
              <button
                onClick={() => loadPreset('rust_solvent')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Rust-Monster Solvent Bomb
              </button>
            </div>
          </div>

          {/* 5 Reagent Slot Selectors */}
          <div className="space-y-3">
            {[
              { label: 'Slot 1 · Base Solvent', list: bases, val: baseId, set: setBaseId },
              { label: 'Slot 2 · Active Reagent', list: actives, val: activeId, set: setActiveId },
              { label: 'Slot 3 · Delivery Carrier', list: carriers, val: carrierId, set: setCarrierId },
              { label: 'Slot 4 · Chemical Stabiliser', list: stabilisers, val: stabiliserId, set: setStabiliserId },
              { label: 'Slot 5 · Reaction Catalyst', list: catalysts, val: catalystId, set: setCatalystId }
            ].map((slot) => {
              const currentObj = REAGENTS_CATALOG.find((r) => r.id === slot.val) || slot.list[0];
              const inStock = reagentInventory[currentObj.id] || 0;
              return (
                <div key={slot.label} className="p-3 bg-[#0B0E14] border border-slate-800/90 rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label className="text-xs font-mono text-slate-300">{slot.label}</label>
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      Stock: {inStock} · Direct Buy: {currentObj.baseCost}g · Grade: {currentObj.grade}
                    </span>
                  </div>
                  <select
                    value={slot.val}
                    onChange={(e) => slot.set(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {slot.list.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.baseCost}g · Potency {r.traits.potency} · Stab {r.traits.stability}
                        {r.traits.massDeltaKg !== 0 ? ` · Mass ${r.traits.massDeltaKg}kg` : ''}
                        {r.traits.sulphurSensitivity !== 0 ? ` · SulphurSens ${r.traits.sulphurSensitivity}` : ''})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5">{currentObj.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Blueprint Name & Brew Action */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={`Custom Name (default: ${previewProduct.name})`}
            className="flex-1 bg-[#0B0E14] border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleSynthesize}
            disabled={gold < missingCost}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Brew Batch (+{batchUnits} Units · {missingCost}g Spot Cost)
          </button>
        </div>
      </div>

      {/* Right 5 Cols: Stoichiometric Assay Preview & Reagent Procurement */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <h3 className="font-display text-base font-bold text-slate-100">
              02. Stoichiometric Reaction Assay
            </h3>
            <span className="text-xs font-mono text-amber-400">
              Target: {previewProduct.targetAudience} · #{previewProduct.formulaSignature}
            </span>
          </div>

          <div className="mb-4">
            <div className="text-base font-semibold text-slate-100 mb-1">
              {previewProduct.name}{' '}
              <span className="text-xs font-mono text-emerald-400">
                [Formula #{previewProduct.formulaSignature}]
              </span>
            </div>
            <div className="text-xs font-mono text-slate-400 tabular-nums">
              Canonical ID: {previewProduct.id} · Unit Cost: {previewProduct.productionCost}g · Suggested Retail: {previewProduct.suggestedPrice}g
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono tabular-nums">
            <div className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded">
              <span className="text-slate-400 block">Potency / Yield</span>
              <span className="text-sm font-semibold text-emerald-400">{previewProduct.potency} / 100</span>
            </div>
            <div className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded">
              <span className="text-slate-400 block">Chemical Stability</span>
              <span className="text-sm font-semibold text-sky-400">{previewProduct.stability} / 100</span>
            </div>
            <div className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded">
              <span className="text-slate-400 block">Hero Mass Shift</span>
              <span className="text-sm font-semibold text-amber-300">
                {previewProduct.massEffectKg === 0 ? '0kg (Normal)' : `${previewProduct.massEffectKg}kg (Featherweight)`}
              </span>
            </div>
            <div className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded">
              <span className="text-slate-400 block">Sulphur Fog Reaction</span>
              <span className={`text-sm font-semibold ${previewProduct.sulphurVulnerable ? 'text-rose-400' : 'text-emerald-400'}`}>
                {previewProduct.sulphurVulnerable ? 'VULNERABLE (-55%)' : 'STABILISED'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-300 bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <div className="font-mono text-slate-400">Causal Expedition Interactions:</div>
            {previewProduct.reactionNotes.map((note, idx) => (
              <p key={idx} className="leading-relaxed text-slate-200">
                • {note}
              </p>
            ))}
          </div>
        </div>

        {/* Wholesale Reagent Stockpile Drawer */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5 flex-1">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="font-display text-sm font-bold text-slate-100">
              Reagent Wholesale Exchange
            </h3>
            <div className="flex gap-1">
              {(['all', 'base', 'active', 'stabiliser'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setMarketFilter(role)}
                  className={`px-2 py-1 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
                    marketFilter === role ? 'bg-amber-600 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {role.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {availableReagents
              .filter((r) => marketFilter === 'all' || r.role === marketFilter)
              .map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 p-2 bg-[#0B0E14] border border-slate-800/80 rounded text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">{r.name}</div>
                    <div className="text-slate-400 font-mono tabular-nums">
                      {r.role} · {r.grade} · Held: {reagentInventory[r.id] || 0}
                    </div>
                  </div>
                  <button
                    onClick={() => onBuyReagent(r, 3)}
                    disabled={gold < r.baseCost * 3}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-mono rounded cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                  >
                    Buy 3 ({r.baseCost * 3}g)
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TrapWorkshopProps {
  gold: number;
  unlockedRegions: RegionId[];
  partInventory: Record<string, number>;
  zincGuardUnlocked: boolean;
  autoResetCamUnlocked: boolean;
  onAssembleTrap: (product: CraftedProduct, cost: number, consumedIds: string[]) => void;
  onBuyPart: (part: TrapPart, qty: number) => void;
}

export const TrapWorkshopPanel: React.FC<TrapWorkshopProps> = ({
  gold,
  unlockedRegions,
  partInventory,
  zincGuardUnlocked,
  autoResetCamUnlocked,
  onAssembleTrap,
  onBuyPart
}) => {
  const availableParts = useMemo(
    () => TRAP_PARTS_CATALOG.filter((p) => unlockedRegions.includes(p.regionTier)),
    [unlockedRegions]
  );

  const triggers = availableParts.filter((p) => p.role === 'trigger');
  const concealments = availableParts.filter((p) => p.role === 'concealment');
  const deliveries = availableParts.filter((p) => p.role === 'delivery');
  const payloads = availableParts.filter((p) => p.role === 'payload');
  const powers = availableParts.filter((p) => p.role === 'power');
  const resets = availableParts.filter((p) => p.role === 'reset');

  const [triggerId, setTriggerId] = useState(triggers[0].id);
  const [concealId, setConcealId] = useState(concealments[0].id);
  const [deliveryId, setDeliveryId] = useState(deliveries[0].id);
  const [payloadId, setPayloadId] = useState(payloads[0].id);
  const [powerId, setPowerId] = useState(powers[0].id);
  const [resetId, setResetId] = useState(resets[0].id);
  const [customName, setCustomName] = useState('');
  const [partFilter, setPartFilter] = useState<TrapSlotRole | 'all'>('all');

  const selectedTuple = useMemo((): [TrapPart, TrapPart, TrapPart, TrapPart, TrapPart, TrapPart] => {
    const tr = TRAP_PARTS_CATALOG.find((p) => p.id === triggerId) || triggers[0];
    const cn = TRAP_PARTS_CATALOG.find((p) => p.id === concealId) || concealments[0];
    const dl = TRAP_PARTS_CATALOG.find((p) => p.id === deliveryId) || deliveries[0];
    const py = TRAP_PARTS_CATALOG.find((p) => p.id === payloadId) || payloads[0];
    const pw = TRAP_PARTS_CATALOG.find((p) => p.id === powerId) || powers[0];
    const rs = TRAP_PARTS_CATALOG.find((p) => p.id === resetId) || resets[0];
    return [tr, cn, dl, py, pw, rs];
  }, [triggerId, concealId, deliveryId, payloadId, powerId, resetId, triggers, concealments, deliveries, payloads, powers, resets]);

  const previewTrap = useMemo(
    () => assembleTrapProduct(selectedTuple, customName, zincGuardUnlocked, autoResetCamUnlocked),
    [selectedTuple, customName, zincGuardUnlocked, autoResetCamUnlocked]
  );

  const loadTrapPreset = (preset: 'plate_45kg' | 'sulphur_fog_machine' | 'basilisk_lair' | 'quartz_8kg_acid') => {
    if (preset === 'plate_45kg') {
      setTriggerId('part_trg_01');
      setConcealId('part_con_02');
      setDeliveryId('part_del_03');
      setPayloadId('part_pay_01');
      setPowerId('part_pow_02');
      setResetId('part_rst_02');
      setCustomName('45kg Pressure-Plate Spike Battery');
    } else if (preset === 'sulphur_fog_machine') {
      setTriggerId(unlockedRegions.includes('warrens') ? 'part_trg_07' : 'part_trg_01');
      setConcealId(unlockedRegions.includes('warrens') ? 'part_con_04' : 'part_con_02');
      setDeliveryId(unlockedRegions.includes('warrens') ? 'part_del_04' : 'part_del_02');
      setPayloadId(unlockedRegions.includes('warrens') ? 'part_pay_05' : 'part_pay_02');
      setPowerId(unlockedRegions.includes('warrens') ? 'part_pow_04' : 'part_pow_02');
      setResetId(unlockedRegions.includes('warrens') ? 'part_rst_03' : 'part_rst_02');
      setCustomName('Pneumatic Sulphur-Fog Machine');
    } else if (preset === 'basilisk_lair') {
      setTriggerId('part_trg_02');
      setConcealId(unlockedRegions.includes('warrens') ? 'part_con_03' : 'part_con_02');
      setDeliveryId('part_del_02');
      setPayloadId(unlockedRegions.includes('warrens') ? 'part_pay_04' : 'part_pay_03');
      setPowerId('part_pow_02');
      setResetId('part_rst_02');
      setCustomName('Armored Cave-Basilisk Lair Module');
    } else if (preset === 'quartz_8kg_acid') {
      setTriggerId(unlockedRegions.includes('warrens') ? 'part_trg_05' : 'part_trg_02');
      setConcealId(unlockedRegions.includes('warrens') ? 'part_con_05' : 'part_con_02');
      setDeliveryId(unlockedRegions.includes('warrens') ? 'part_del_06' : 'part_del_03');
      setPayloadId(unlockedRegions.includes('warrens') ? 'part_pay_06' : 'part_pay_03');
      setPowerId(unlockedRegions.includes('warrens') ? 'part_pow_05' : 'part_pow_02');
      setResetId(unlockedRegions.includes('warrens') ? 'part_rst_04' : 'part_rst_02');
      setCustomName('8kg Quartz-Wire Vitriol Sprayer');
    }
  };

  const missingCost = selectedTuple.reduce((acc, p) => {
    const have = partInventory[p.id] || 0;
    return acc + (have > 0 ? 0 : p.baseCost);
  }, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 Cols: 6-Slot Modular Trap Engineering Bench */}
      <div className="lg:col-span-7 bg-[#131822] border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-800">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-100">
                01. Six-Slot Modular Trap &amp; Hazard Rig
              </h2>
              <p className="text-xs text-slate-400">
                Assemble Trigger + Concealment + Delivery + Payload + Power + Reset. Trigger mass rules govern expedition physics.
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400 tabular-nums">
              {availableParts.length} / 64 Modules Unlocked
            </span>
          </div>

          <div className="mb-4">
            <p className="text-xs font-mono text-slate-400 mb-2">Load Canonical Engineering Blueprint:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadTrapPreset('plate_45kg')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md cursor-pointer whitespace-nowrap shrink-0"
              >
                45kg Spike Plate (Bypassable by Chicken-Morph)
              </button>
              <button
                onClick={() => loadTrapPreset('sulphur_fog_machine')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-md cursor-pointer whitespace-nowrap shrink-0"
              >
                Sulphur-Fog Machine (Weakens Antidotes)
              </button>
              <button
                onClick={() => loadTrapPreset('basilisk_lair')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-md cursor-pointer whitespace-nowrap shrink-0"
              >
                Cave-Basilisk Petrification Lair
              </button>
              <button
                onClick={() => loadTrapPreset('quartz_8kg_acid')}
                className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-md cursor-pointer whitespace-nowrap shrink-0"
              >
                8kg Hair-Trigger Acid (Catches Chicken-Morph!)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: '1. Trigger Sensor', list: triggers, val: triggerId, set: setTriggerId },
              { label: '2. Concealment Shroud', list: concealments, val: concealId, set: setConcealId },
              { label: '3. Delivery Mechanism', list: deliveries, val: deliveryId, set: setDeliveryId },
              { label: '4. Hazard Payload', list: payloads, val: payloadId, set: setPayloadId },
              { label: '5. Power Actuator', list: powers, val: powerId, set: setPowerId },
              { label: '6. Reset & Maintenance', list: resets, val: resetId, set: setResetId }
            ].map((slot) => {
              const currentPart = TRAP_PARTS_CATALOG.find((p) => p.id === slot.val) || slot.list[0];
              const held = partInventory[currentPart.id] || 0;
              return (
                <div key={slot.label} className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-1">
                    <span>{slot.label}</span>
                    <span className="text-slate-400 tabular-nums">
                      Held: {held} · {currentPart.baseCost}g
                    </span>
                  </div>
                  <select
                    value={slot.val}
                    onChange={(e) => slot.set(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {slot.list.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.baseCost}g · DC {p.detectionDC} · Leth {p.lethality}
                        {p.massThresholdKg !== undefined ? ` · >=${p.massThresholdKg}kg` : ''})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{currentPart.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={`Custom Blueprint Name (default: ${previewTrap.name})`}
            className="flex-1 bg-[#0B0E14] border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => {
              if (gold < missingCost) return;
              onAssembleTrap(
                previewTrap,
                missingCost,
                selectedTuple.map((p) => p.id)
              );
              setCustomName('');
            }}
            disabled={gold < missingCost}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Assemble 2 Units ({missingCost}g Spot Cost)
          </button>
        </div>
      </div>

      {/* Right 5 Cols: Prototype Mass & Counterplay Test Rig + Part Procurement */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <h3 className="font-display text-base font-bold text-slate-100">
              02. Prototype Mass &amp; Counterplay Test Rig
            </h3>
            <span className="text-xs font-mono text-rose-400">
              For Dungeon Masters · #{previewTrap.formulaSignature}
            </span>
          </div>

          <div className="mb-4">
            <div className="text-base font-semibold text-slate-100">
              {previewTrap.name}{' '}
              <span className="text-xs font-mono text-amber-400">
                [Build #{previewTrap.formulaSignature}]
              </span>
            </div>
            <div className="text-xs font-mono text-slate-400 tabular-nums">
              Canonical ID: {previewTrap.id} · Assembly Cost: {previewTrap.productionCost}g · Suggested Contract Price: {previewTrap.suggestedPrice}g
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mb-4 text-xs font-mono tabular-nums">
            <div className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded">
              <span className="text-slate-400 block">Lethality</span>
              <span className="text-sm font-semibold text-rose-400">{previewTrap.potency}</span>
            </div>
            <div className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded">
              <span className="text-slate-400 block">Deterrence</span>
              <span className="text-sm font-semibold text-amber-400">{previewTrap.stability}</span>
            </div>
            <div className="p-2.5 bg-[#0B0E14] border border-slate-800 rounded">
              <span className="text-slate-400 block">Detection DC</span>
              <span className="text-sm font-semibold text-sky-400">DC {previewTrap.detectionDC}</span>
            </div>
          </div>

          {previewTrap.recipeComponents.includes('part_rst_09') && <p className="text-sm text-amber-200 mb-3">Each purchased installation includes one temporal rewind. It prevents one wear removal, consumes that charge, then wears normally. A new paid installation replenishes it.</p>}
          {/* Mass Trigger Calibration vs Chicken-Morph Test */}
          <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded-lg mb-4 text-xs">
            <div className="font-mono text-slate-300 mb-1.5">
              Trigger Calibration: {previewTrap.recipeComponents.includes('part_trg_12') ? 'Inversion: under 25kg' : `${previewTrap.triggerMassThresholdKg}kg floor threshold`}
            </div>
            {[19, 21, 25, 54, 86].map(mass => {
              const triggers = isTrapTriggeredByMass(previewTrap, mass);
              const label = mass === 86 ? 'Standard Vanguard (~86kg)' : mass === 21 ? 'Chicken-Morphed Hero (~21kg)' : `Calibration hero (${mass}kg)`;
              return (
                <div key={mass} data-mass-calibration={mass} className="flex items-center justify-between gap-2 text-slate-400 font-mono tabular-nums py-1 border-b border-slate-800/70">
                  <span>{label}:</span>
                  <span className={triggers ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {triggers ? 'TRIGGERS SENSOR' : 'BYPASSES SENSOR'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="font-mono text-slate-400">Published Counterplay Routes ({previewTrap.counterClasses.join(' · ')}):</div>
            {previewTrap.reactionNotes.map((n, i) => (
              <p key={i} className="text-slate-300">
                • {n}
              </p>
            ))}
          </div>
        </div>

        {/* Machine Parts Wholesale Exchange */}
        <div className="bg-[#131822] border border-slate-800 rounded-xl p-5 flex-1">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="font-display text-sm font-bold text-slate-100">
              Foundry Module Supply
            </h3>
            <div className="flex gap-1">
              {(['all', 'trigger', 'payload', 'reset'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setPartFilter(role)}
                  className={`px-2 py-1 text-xs font-mono rounded cursor-pointer whitespace-nowrap shrink-0 ${
                    partFilter === role ? 'bg-amber-600 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {role.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {availableParts
              .filter((p) => partFilter === 'all' || p.role === partFilter)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 p-2 bg-[#0B0E14] border border-slate-800/80 rounded text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">{p.name}</div>
                    <div className="text-slate-400 font-mono tabular-nums">
                      {p.role} · DC {p.detectionDC} · Held: {partInventory[p.id] || 0}
                    </div>
                  </div>
                  <button
                    onClick={() => onBuyPart(p, 2)}
                    disabled={gold < p.baseCost * 2}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-mono rounded cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                  >
                    Buy 2 ({p.baseCost * 2}g)
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
