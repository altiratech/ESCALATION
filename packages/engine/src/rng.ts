import { hashSeed } from './utils';

export class SeededRng {
  private state: number;

  readonly trace: number[] = [];

  constructor(seedOrState: string | number) {
    this.state = typeof seedOrState === 'number' ? seedOrState >>> 0 : hashSeed(seedOrState);
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  next(): number {
    // xorshift32
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    const output = (this.state & 0xffffffff) / 0x100000000;
    this.trace.push(output);
    return output;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    const sample = this.next();
    return Math.floor(sample * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  nextCenteredNoise(magnitude: number): number {
    return (this.next() * 2 - 1) * magnitude;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty list');
    }
    const index = this.nextInt(0, items.length - 1);
    return items[index] as T;
  }

  weightedPick<T>(items: readonly T[], score: (item: T) => number): T {
    const weights = items.map((item) => Math.max(0.0001, score(item)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const threshold = this.next() * total;

    let running = 0;
    for (let index = 0; index < items.length; index += 1) {
      running += weights[index] ?? 0;
      if (running >= threshold) {
        return items[index] as T;
      }
    }

    return items[items.length - 1] as T;
  }

  getState(): number {
    return this.state >>> 0;
  }
}
