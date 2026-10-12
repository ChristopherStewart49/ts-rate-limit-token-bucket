# ts-rate-limit-token-bucket

Tracks a fixed-capacity bucket of tokens that refills at a steady rate per millisecond. Calling `tryRemove(n)` tells you whether `n` tokens are available and, if not, how many milliseconds you must wait until they are.

## Usage

```js
import { TokenBucket } from 'ts-rate-limit-token-bucket';

const limiter = new TokenBucket({
  capacity: 5,          // bucket holds at most 5 tokens
  refillPerMs: 1 / 1000, // 1 token per second
  now: Date.now,         // injectable clock
});

const r = limiter.tryRemove(1);
if (r.ok) {
  // proceed
} else {
  // wait r.waitMs milliseconds, then retry
}
```

`tryRemove` returns `{ ok: true }` on success or `{ ok: false, waitMs }` when there are not enough tokens. `waitMs` is the number of milliseconds until enough tokens exist to satisfy the request. A request for more tokens than the bucket's `capacity` returns `{ ok: false, waitMs: Infinity }`, since it can never succeed no matter how long you wait.

## Why

Most rate-limit libraries bundle a storage backend, a middleware adapter, or a distributed coordination story. When the only need is a small, self-contained limiter for a single process, those concerns are noise. This library is the minimal token-bucket primitive with no third-party dependencies and an injectable clock so tests stay deterministic.

## Edge case

`tryRemove` always refills the bucket *before* deciding, so back-to-back calls reflect the current logical time, not a stale snapshot. If the injected clock moves backwards, the refill step is a no-op — tokens are never drained by a negative time delta.
