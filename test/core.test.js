import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket } from '../src/index.js';

function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms) => { t += ms; },
    set: (v) => { t = v; },
  };
}

test('constructor rejects non-positive capacity', () => {
  assert.throws(() => new TokenBucket({ capacity: 0, refillPerMs: 1, now: Date.now }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: -1, refillPerMs: 1, now: Date.now }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: NaN, refillPerMs: 1, now: Date.now }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: Infinity, refillPerMs: 1, now: Date.now }), RangeError);
});

test('constructor rejects non-positive refillPerMs', () => {
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerMs: 0, now: Date.now }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerMs: -1, now: Date.now }), RangeError);
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerMs: NaN, now: Date.now }), RangeError);
});

test('constructor rejects non-function now', () => {
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerMs: 1, now: 'oops' }), TypeError);
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerMs: 1, now: 42 }), TypeError);
});

test('tryRemove rejects non-positive or non-finite tokens', () => {
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: Date.now });
  assert.throws(() => b.tryRemove(0), RangeError);
  assert.throws(() => b.tryRemove(-1), RangeError);
  assert.throws(() => b.tryRemove(NaN), RangeError);
  assert.throws(() => b.tryRemove(Infinity), RangeError);
});

test('starts full, so first request succeeds', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: clock.now });
  assert.deepStrictEqual(b.tryRemove(5), { ok: true });
});

test('returns {ok:false, waitMs} when not enough tokens', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: clock.now });
  assert.deepStrictEqual(b.tryRemove(5), { ok: true });
  assert.deepStrictEqual(b.tryRemove(1), { ok: false, waitMs: 1 });
});

test('refills continuously after elapsed time', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: clock.now });
  assert.deepStrictEqual(b.tryRemove(5), { ok: true });
  clock.advance(3);
  assert.deepStrictEqual(b.tryRemove(3), { ok: true });
  assert.deepStrictEqual(b.tryRemove(1), { ok: false, waitMs: 1 });
});

test('refill is capped at capacity', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: clock.now });
  b.tryRemove(5);
  clock.advance(100);
  assert.deepStrictEqual(b.tryRemove(5), { ok: true });
});

test('fractional tokens are supported', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 1, refillPerMs: 0.5, now: clock.now });
  b.tryRemove(1);
  assert.deepStrictEqual(b.tryRemove(0.5), { ok: false, waitMs: 1 });
  clock.advance(1);
  assert.deepStrictEqual(b.tryRemove(0.5), { ok: true });
});

test('request larger than capacity returns {ok:false, waitMs: Infinity}', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: clock.now });
  assert.deepStrictEqual(b.tryRemove(6), { ok: false, waitMs: Infinity });
});

test('default tokens argument is 1', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 1, refillPerMs: 1, now: clock.now });
  assert.deepStrictEqual(b.tryRemove(), { ok: true });
});

test('zero elapsed time does not refill', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: clock.now });
  b.tryRemove(5);
  assert.deepStrictEqual(b.tryRemove(1), { ok: false, waitMs: 1 });
  assert.deepStrictEqual(b.tryRemove(1), { ok: false, waitMs: 1 });
});

test('negative clock movement is ignored, not treated as draining', () => {
  const clock = fakeClock();
  const b = new TokenBucket({ capacity: 5, refillPerMs: 1, now: clock.now });
  clock.set(-10);
  assert.deepStrictEqual(b.tryRemove(5), { ok: true });
});
