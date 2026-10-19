import { CraftedProduct, InstallationMechanics } from '../types/game';

/** Exactly the existing resolved installation mechanics; names/prices are not evidence. */
export function installationMechanics(p: CraftedProduct): InstallationMechanics {
  return { potency: p.potency, detectionDC: p.detectionDC, threshold: p.triggerMassThresholdKg,
    inversion: p.recipeComponents.includes('part_trg_12'), temporal: p.recipeComponents.includes('part_rst_09'),
    petrification: p.causesPetrification, fog: p.emitsSulphurFog, sabotage: p.counterClasses.includes('sabotage') };
}
export function triggersAt(m: InstallationMechanics, mass: number): boolean {
  return m.inversion ? mass < 25 : m.threshold <= 0 || mass >= m.threshold;
}
export function sameMechanics(a: InstallationMechanics, b: InstallationMechanics): boolean {
  return (Object.keys(a) as (keyof InstallationMechanics)[]).every(k => a[k] === b[k]);
}
