export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickOne<T>(values: T[]): T {
  if (values.length === 0) {
    throw new Error('Cannot pick from an empty array.');
  }
  return values[randomInt(0, values.length - 1)];
}
