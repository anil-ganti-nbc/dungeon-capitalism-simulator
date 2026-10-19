import { DailyMarketContext, RegionId } from '../types/game';
import { DeterministicRNG, hashString } from '../utils/prng';
import { SIM_RULES_VERSION } from './simulation';

/** Domain-separated daily stream: independent of strategy and incidental RNG draws.
 * Reconstructible from saved inputs; contracts/financial records retain the operative context. */
export function getDailyMarketContext(seed: number, day: number, region: RegionId,
  rulesVersion = SIM_RULES_VERSION): DailyMarketContext {
  const key = `market-v1|${rulesVersion}|${seed}|${day}|${region}`;
  const rng = new DeterministicRNG(parseInt(hashString(key).slice(-8), 16));
  return { version: 'market-v1', rulesVersion, seed, day, region,
    factor: 0.85 + rng.next() * 0.37 };
}
