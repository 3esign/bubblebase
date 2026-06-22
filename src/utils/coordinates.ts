export function encodeCoordinate(x: number, y: number): bigint {
  const x32 = Int32Array.of(x)[0];
  const y32 = Int32Array.of(y)[0];
  const uX = BigInt(x32 & 0xffffffff);
  const uY = BigInt(y32 & 0xffffffff);
  return (uX << 32n) | uY;
}

export function decodeCoordinate(key: bigint): { x: number; y: number } {
  const uX = Number((key >> 32n) & 0xffffffffn);
  const uY = Number(key & 0xffffffffn);
  const x = (uX & 0x80000000) ? (uX - 0x100000000) : uX;
  const y = (uY & 0x80000000) ? (uY - 0x100000000) : uY;
  return { x, y };
}
