const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const encodeTime = (timeMs: number): string => {
  let value = Math.floor(timeMs);
  let output = "";
  for (let index = 0; index < 10; index += 1) {
    output = CROCKFORD[value % 32]! + output;
    value = Math.floor(value / 32);
  }
  return output;
};

export const createUlid = (
  now = Date.now(),
  randomBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): string => {
  const random = Array.from(randomBytes, (byte) => CROCKFORD[byte % 32]!).join(
    "",
  );
  return `${encodeTime(now)}${random}`;
};
