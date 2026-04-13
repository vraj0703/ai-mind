/**
 * HttpJobScheduler — HTTP client for the v1 cron service.
 *
 * Ports v1 senses/gateway/cron.js into v2/mind's DDD structure.
 * Talks to services/cron (default http://127.0.0.1:3479).
 * Never throws — returns null / false / { ok: false } on failure.
 */

const { IJobScheduler } = require("../../../domain/repositories/i_job_scheduler");
const { CRON_HOST } = require("../../../domain/constants");

const DEFAULT_TIMEOUT_MS = 5_000;

class HttpJobScheduler extends IJobScheduler {
  /**
   * @param {object} [opts]
   * @param {string} [opts.host] - cron service base URL
   * @param {number} [opts.timeout] - request timeout in ms
   */
  constructor(opts = {}) {
    super();
    this.host = opts.host || CRON_HOST;
    this.timeout = opts.timeout || DEFAULT_TIMEOUT_MS;
  }

  async _get(path) {
    try {
      const res = await fetch(`${this.host}${path}`, {
        signal: AbortSignal.timeout(this.timeout),
      });
      if (!res.ok) {
        console.log(`[mind-v2] cron: GET ${path} HTTP ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.log(`[mind-v2] cron: GET ${path} error: ${err.message}`);
      return null;
    }
  }

  async _post(path, body) {
    try {
      const res = await fetch(`${this.host}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      });
      if (!res.ok) {
        console.log(`[mind-v2] cron: POST ${path} HTTP ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err) {
      console.log(`[mind-v2] cron: POST ${path} error: ${err.message}`);
      return null;
    }
  }

  /** @returns {Promise<{active: number, paused: number, total: number} | null>} */
  async health() {
    const data = await this._get("/health");
    if (!data || !data.jobs) return null;
    return {
      active: data.jobs.active || 0,
      paused: data.jobs.paused || 0,
      total: data.jobs.total || 0,
    };
  }

  /** @returns {Promise<object[]>} */
  async listJobs() {
    const data = await this._get("/jobs");
    return Array.isArray(data?.jobs) ? data.jobs : [];
  }

  /** @param {string} key */
  async triggerJob(key) {
    const data = await this._post("/trigger", { key });
    if (!data) return { ok: false, error: "cron service unreachable" };
    if (data.ok) return { ok: true, result: data.result };
    return { ok: false, error: data.error || "unknown error" };
  }

  /** @param {string} key */
  async pauseJob(key) {
    const data = await this._post("/pause", { key });
    return Boolean(data && data.ok);
  }

  /** @param {string} key */
  async resumeJob(key) {
    const data = await this._post("/resume", { key });
    return Boolean(data && data.ok);
  }

  /** @returns {Promise<object[]>} */
  async jobHistory() {
    const data = await this._get("/history");
    return Array.isArray(data?.history) ? data.history : [];
  }
}

module.exports = { HttpJobScheduler };
