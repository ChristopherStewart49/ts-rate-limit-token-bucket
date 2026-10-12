/**
 * A token-bucket rate limiter.
 *
 * The bucket holds at most `capacity` tokens. Tokens are replenished at a
 * fixed rate of `refillPerMs` tokens per millisecond. A `tryRemove` call that
 * arrives when fewer than the requested tokens are available reports the
 * *wait time* until enough tokens exist, so the caller can retry or back off.
 *
 * `now` is an injectable clock (a function returning the current time in
 * milliseconds). In production, pass `Date.now`. In tests, pass a function that
 * returns a deterministic, controlled value so assertions never touch the
 * wall clock.
 */
export class TokenBucket {
  #capacity;
  #refillPerMs;
  #now;
  #tokens;
  #lastRefill;

  constructor({ capacity, refillPerMs, now }) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new RangeError('capacity must be a finite positive number');
    }
    if (!Number.isFinite(refillPerMs) || refillPerMs <= 0) {
      throw new RangeError('refillPerMs must be a finite positive number');
    }
    if (typeof now !== 'function') {
      throw new TypeError('now must be a function');
    }
    this.#capacity = capacity;
    this.#refillPerMs = refillPerMs;
    this.#now = now;
    this.#tokens = capacity;
    this.#lastRefill = now();
  }

  /**
   * Bring the stored token count up to date for the moment this is called.
   * @private
   */
  #refill() {
    const t = this.#now();
    const elapsed = t - this.#lastRefill;
    if (elapsed > 0) {
      const added = elapsed * this.#refillPerMs;
      this.#tokens = Math.min(this.#capacity, this.#tokens + added);
      this.#lastRefill = t;
    }
    return this.#tokens;
  }

  /**
   * Attempt to remove `tokens` from the bucket.
   *
   * Returns `{ ok: true }` on success, or `{ ok: false, waitMs }` where
   * `waitMs` is how many milliseconds must elapse before the bucket holds
   * enough tokens to satisfy the request.
   *
   * Always refills the bucket before deciding, so the result reflects the
   * current logical time, not a stale snapshot.
   */
  tryRemove(tokens = 1) {
    if (!Number.isFinite(tokens) || tokens <= 0) {
      throw new RangeError('tokens must be a finite positive number');
    }
    if (tokens > this.#capacity) {
      // Can NEVER satisfy: even a full bucket is not enough.  Returning
      // a finite waitMs would mislead the caller, so we return Infinity.
      return { ok: false, waitMs: Infinity };
    }
    this.#refill();
    if (this.#tokens >= tokens) {
      this.#tokens -= tokens;
      return { ok: true };
    }
    const deficit = tokens - this.#tokens;
    const waitMs = deficit / this.#refillPerMs;
    return { ok: false, waitMs };
  }
}
