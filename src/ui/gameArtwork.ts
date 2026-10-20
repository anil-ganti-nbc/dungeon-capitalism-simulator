import { INITIAL_MASTERS, INITIAL_PARTIES, INITIAL_RIVALS, REGIONS_DATA } from '../data/world';
import { INITIAL_PRODUCTS, REAGENTS_CATALOG, TRAP_PARTS_CATALOG } from '../data/catalog';
export interface GameArtwork {src:string;alt:string;author:string;licence:string;sha256:string;}
// Populate ONLY from a verified art-director handoff. No guessed paths, icons or remote fetches.
export { FINAL_GAME_ART as APPROVED_GAME_ART } from './finalGameArt';
export const ENTITY_ART_SLOTS:Record<string,{kind:string;label:string}>=Object.fromEntries([
  ...REGIONS_DATA.map(x=>[x.id,{kind:'dungeon',label:x.name}]),
  ...INITIAL_MASTERS.map(x=>[x.id,{kind:'master',label:x.name}]),
  ...INITIAL_PARTIES.map(x=>[x.id,{kind:'party',label:x.name}]),
  ...INITIAL_RIVALS.map(x=>[x.id,{kind:'rival',label:x.name}]),
  ...INITIAL_PRODUCTS.map(x=>[x.id,{kind:'product',label:x.name}]),
  ...REAGENTS_CATALOG.map(x=>[x.id,{kind:'reagent',label:x.name}]),
  ...TRAP_PARTS_CATALOG.map(x=>[x.id,{kind:'part',label:x.name}])
]);
