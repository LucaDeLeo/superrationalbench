import { describe, expect, it } from "bun:test";

import { SeededRandom, createSeededRandom } from "../seeded-random";

// Run with: bun test src/cooperation/__tests__/seeded-random.test.ts

describe("SeededRandom", () => {
  it("produces identical sequences for the same seed", () => {
    const rngA = new SeededRandom(1337);
    const rngB = new SeededRandom(1337);

    const sequenceA = Array.from({ length: 5 }, () => rngA.nextFloat());
    const sequenceB = Array.from({ length: 5 }, () => rngB.nextFloat());

    expect(sequenceA).toEqual([
      0.5084511365315184,
      0.10017107152388015,
      0.7249642325215806,
      0.561273929924366,
      0.9603433012777676,
    ]);
    expect(sequenceB).toEqual(sequenceA);
  });

  it("diverges for different seeds", () => {
    const defaultRng = new SeededRandom();
    const customRng = new SeededRandom(21);

    const defaultSeedSequence = Array.from({ length: 5 }, () => defaultRng.nextFloat());
    const customSeedSequence = Array.from({ length: 5 }, () => customRng.nextFloat());

    expect(defaultSeedSequence).not.toEqual(customSeedSequence);
  });

  it("respects nextInt bounds deterministically", () => {
    const rng = new SeededRandom(42);
    const ints = Array.from({ length: 10 }, () => rng.nextInt(10));

    expect(ints).toEqual([5, 1, 2, 3, 9, 5, 3, 9, 9, 7]);

    const ranged = rng.nextInt(20, 10);
    expect(ranged).toBeGreaterThanOrEqual(10);
    expect(ranged).toBeLessThan(20);
  });

  it("shuffles arrays deterministically", () => {
    const original = [1, 2, 3, 4, 5];
    const rng = new SeededRandom(42);
    rng.shuffle(original);

    expect(original).toEqual([2, 5, 4, 1, 3]);
  });

  it("picks deterministic choices and throws on empty input", () => {
    const items = ["alpha", "beta", "gamma"];
    const rng = new SeededRandom(42);

    expect(rng.choice(items)).toBe("beta");
    expect(rng.choice(items)).toBe("alpha");

    expect(() => rng.choice([])).toThrow("choice requires a non-empty array");
  });

  it("supports the factory helper", () => {
    const rng = createSeededRandom();
    const explicit = new SeededRandom(42);

    expect(rng.nextFloat()).toBeCloseTo(explicit.nextFloat());
  });

  it("rejects invalid integer bounds", () => {
    const rng = new SeededRandom(42);

    expect(() => rng.nextInt(3.14)).toThrow("nextInt requires integer bounds");
    expect(() => rng.nextInt(5, 5)).toThrow(
      "maxExclusive must be greater than minInclusive",
    );
  });
});
