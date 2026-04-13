/**
 * IJobScheduler — interface for a cron-style job scheduler.
 *
 * Implementations talk to an external cron service (e.g. v1 services/cron).
 * All methods must return null / { ok: false } on failure, never throw.
 */

class IJobScheduler {
  /** @returns {Promise<{active: number, paused: number, total: number} | null>} */
  async health() { throw new Error("not implemented"); }

  /** @returns {Promise<object[]>} */
  async listJobs() { throw new Error("not implemented"); }

  /** @param {string} key @returns {Promise<{ok: boolean, result?: object, error?: string}>} */
  async triggerJob(key) { throw new Error("not implemented"); }

  /** @param {string} key @returns {Promise<boolean>} */
  async pauseJob(key) { throw new Error("not implemented"); }

  /** @param {string} key @returns {Promise<boolean>} */
  async resumeJob(key) { throw new Error("not implemented"); }

  /** @returns {Promise<object[]>} */
  async jobHistory() { throw new Error("not implemented"); }
}

module.exports = { IJobScheduler };
