/**
 * Token-bucket pacer for outbound pCloud API requests.
 *
 * Proactively limits request rate instead of reacting to 429 errors.
 * Inspired by rclone's pacer: minSleep=10ms, maxSleep=2s, decay=2.
 */

export interface PacerOptions {
  /** Minimum delay between requests in milliseconds (default: 10). */
  minSleepMs: number;
  /** Maximum delay in milliseconds (default: 2000). */
  maxSleepMs: number;
  /** Backoff multiplier on throttle (429/5xx) (default: 2). */
  decay: number;
  /** Initial target rate in requests per second (default: 50). */
  initialRate: number;
}

const DEFAULT_OPTIONS: PacerOptions = {
  minSleepMs: 10,
  maxSleepMs: 2000,
  decay: 2,
  initialRate: 50,
};

export class Pacer {
  private readonly minSleepMs: number;
  private readonly maxSleepMs: number;
  private readonly decay: number;
  private currentSleepMs: number;
  private lastRequestTime: number = 0;

  constructor(options: Partial<PacerOptions> = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.minSleepMs = opts.minSleepMs;
    this.maxSleepMs = opts.maxSleepMs;
    this.decay = opts.decay;
    this.currentSleepMs = 1000 / opts.initialRate; // convert req/s to ms between requests
  }

  /**
   * Wait until the next request slot is available.
   * Enforces minimum spacing between requests.
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.currentSleepMs) {
      const waitMs = this.currentSleepMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Called on successful 2xx response.
   * Gradually decreases sleep (increases rate) toward minSleepMs.
   */
  noteSuccess(): void {
    // Linear recovery: reduce sleep by 10% toward minSleepMs
    this.currentSleepMs = Math.max(
      this.minSleepMs,
      this.currentSleepMs - (this.currentSleepMs - this.minSleepMs) * 0.1
    );
  }

  /**
   * Called on throttle response (429, 5xx).
   * Aggressively increases sleep (decreases rate) by decay factor.
   */
  noteThrottle(): void {
    this.currentSleepMs = Math.min(
      this.maxSleepMs,
      this.currentSleepMs * this.decay
    );
  }

  /** Current effective delay between requests in ms. */
  getCurrentSleepMs(): number {
    return this.currentSleepMs;
  }

  /** Current effective rate in requests per second. */
  getCurrentRate(): number {
    return 1000 / this.currentSleepMs;
  }

  /** Reset to initial rate. */
  reset(): void {
    this.currentSleepMs = 1000 / DEFAULT_OPTIONS.initialRate;
    this.lastRequestTime = 0;
  }
}