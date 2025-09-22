const MODULUS = 2_147_483_647;
const MULTIPLIER = 1_664_525;
const INCREMENT = 1_013_904_223;
const DEFAULT_SEED = 42;

function normalizeSeed(seed: number | undefined): number {
  if (!Number.isFinite(seed ?? Number.NaN)) {
    return DEFAULT_SEED;
  }

  const normalized = Math.floor(Math.abs(seed!)) % MODULUS;
  return normalized;
}

/**
 * Deterministic random generator for cooperation experiments.
 *
 * Quick start usage (see docs/architecture/quick-start-valid-experiment-in-4-5-hours.md):
 * ```ts
 * const random = createSeededRandom();
 * const nextValue = random.nextFloat();
 * ```
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number = DEFAULT_SEED) {
    this.state = normalizeSeed(seed);
  }

  /** Advances the generator and returns a float in [0, 1). */
  next(): number {
    this.state = (this.state * MULTIPLIER + INCREMENT) % MODULUS;
    return this.state / MODULUS;
  }

  /** Returns the next float from the generator. */
  nextFloat(): number {
    return this.next();
  }

  /**
   * Returns a deterministic integer in the range [minInclusive, maxExclusive).
   * Throws when bounds are invalid to prevent silent errors.
   */
  nextInt(maxExclusive: number, minInclusive = 0): number {
    if (!Number.isInteger(maxExclusive) || !Number.isInteger(minInclusive)) {
      throw new Error("nextInt requires integer bounds");
    }
    if (maxExclusive <= minInclusive) {
      throw new Error("maxExclusive must be greater than minInclusive");
    }
    const range = maxExclusive - minInclusive;
    const value = Math.floor(this.next() * range) + minInclusive;
    return value;
  }

  /** Deterministically shuffles the provided array in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = this.nextInt(i + 1);
      if (j !== i) {
        [items[i], items[j]] = [items[j], items[i]];
      }
    }
    return items;
  }

  /** Returns a deterministic element from the provided array. */
  choice<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error("choice requires a non-empty array");
    }
    const index = this.nextInt(items.length);
    return items[index];
  }
}

/** Convenience factory that defaults to the project-standard seed (42). */
export function createSeededRandom(seed: number = DEFAULT_SEED): SeededRandom {
  return new SeededRandom(seed);
}
