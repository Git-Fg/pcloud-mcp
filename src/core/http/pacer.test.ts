import { describe, it, expect, beforeEach } from 'bun:test';
import { Pacer } from './pacer.js';

describe('Pacer', () => {
  let pacer: Pacer;

  beforeEach(() => {
    pacer = new Pacer({
      minSleepMs: 10,
      maxSleepMs: 2000,
      decay: 2,
      initialRate: 50, // 20ms between requests
    });
  });

  it('enforces minimum spacing between requests', async () => {
    const start = Date.now();
    await pacer.acquire();
    await pacer.acquire();
    const elapsed = Date.now() - start;
    // Should wait at least ~20ms between the two acquires
    expect(elapsed).toBeGreaterThanOrEqual(15); // allow small variance
    expect(elapsed).toBeLessThan(50);
  });

  it('noteThrottle increases sleep (decreases rate)', () => {
    const initialRate = pacer.getCurrentRate();
    pacer.noteThrottle();
    expect(pacer.getCurrentRate()).toBeLessThan(initialRate);
    expect(pacer.getCurrentSleepMs()).toBeGreaterThan(20);
  });

  it('noteThrottle caps at maxSleepMs', () => {
    // Push it to max
    for (let i = 0; i < 20; i++) {
      pacer.noteThrottle();
    }
    expect(pacer.getCurrentSleepMs()).toBeLessThanOrEqual(2000);
    expect(pacer.getCurrentSleepMs()).toBeGreaterThanOrEqual(1900);
  });

  it('noteSuccess gradually recovers rate toward minSleepMs', async () => {
    // First throttle heavily
    for (let i = 0; i < 10; i++) {
      pacer.noteThrottle();
    }
    const throttledSleep = pacer.getCurrentSleepMs();
    expect(throttledSleep).toBeGreaterThan(100);

    // Then recover with many successes
    for (let i = 0; i < 50; i++) {
      pacer.noteSuccess();
    }
    const recoveredSleep = pacer.getCurrentSleepMs();
    // Should be much closer to minSleepMs (10)
    expect(recoveredSleep).toBeLessThan(throttledSleep);
    expect(recoveredSleep).toBeLessThan(50);
  });

  it('reset restores initial rate', () => {
    pacer.noteThrottle();
    pacer.noteThrottle();
    const throttledRate = pacer.getCurrentRate();
    expect(throttledRate).toBeLessThan(50);

    pacer.reset();
    expect(pacer.getCurrentRate()).toBe(50);
    expect(pacer.getCurrentSleepMs()).toBe(20);
  });

  it('respects custom minSleepMs and maxSleepMs', () => {
    const custom = new Pacer({
      minSleepMs: 5,
      maxSleepMs: 100,
      decay: 2,
      initialRate: 100, // 10ms
    });
    expect(custom.getCurrentSleepMs()).toBe(10);

    custom.noteThrottle();
    expect(custom.getCurrentSleepMs()).toBe(20);

    // Cap at 100
    for (let i = 0; i < 10; i++) {
      custom.noteThrottle();
    }
    expect(custom.getCurrentSleepMs()).toBe(100);
  });

  it('acquire is nearly instant when spacing already elapsed', async () => {
    await pacer.acquire();
    await new Promise((r) => setTimeout(r, 30)); // wait longer than sleep
    const start = Date.now();
    await pacer.acquire();
    const elapsed = Date.now() - start;
    // Should return almost immediately since enough time passed
    expect(elapsed).toBeLessThan(10);
  });
});