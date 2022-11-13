export class Sequence {
  private seq: number

  constructor(from?: number) {
    this.seq = from ?? 0
  }

  next(): number {
    const current = this.seq
    this.seq += 1
    return current
  }
}
