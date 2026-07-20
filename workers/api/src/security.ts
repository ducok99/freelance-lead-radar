const encoder = new TextEncoder();

const digest = async (value: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

/**
 * So sánh digest có cùng độ dài để không lộ độ dài/điểm sai của TEAM_TOKEN.
 */
export const constantTimeEqual = async (
  candidate: string,
  expected: string,
): Promise<boolean> => {
  const [candidateDigest, expectedDigest] = await Promise.all([
    digest(candidate),
    digest(expected),
  ]);

  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= candidateDigest[index]! ^ expectedDigest[index]!;
  }
  return difference === 0;
};

export const hashToken = async (token: string): Promise<string> =>
  Array.from(await digest(token), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

interface RateWindow {
  count: number;
  startedAtMs: number;
}

/**
 * Bộ đếm theo isolate Worker. Khóa là SHA-256 của token, không giữ token thô.
 */
export class FixedWindowRateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #windows = new Map<string, RateWindow>();

  constructor(limit: number, windowMs = 60_000) {
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  consume(key: string, nowMs: number): boolean {
    const current = this.#windows.get(key);
    if (
      current === undefined ||
      nowMs - current.startedAtMs >= this.#windowMs
    ) {
      this.#windows.set(key, { count: 1, startedAtMs: nowMs });
      return true;
    }

    if (current.count >= this.#limit) {
      return false;
    }

    current.count += 1;
    return true;
  }
}
