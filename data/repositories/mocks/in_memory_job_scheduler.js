/**
 * InMemoryJobScheduler — default in-tree mock for IJobScheduler.
 *
 * Stores scheduled jobs in a Map. Does NOT fire on a real schedule — triggerJob
 * is the only thing that "runs" a job. Good enough for tier-1/tier-2 ops + tests.
 */

const { IJobScheduler } = require("../../../domain/repositories/i_job_scheduler");

class InMemoryJobScheduler extends IJobScheduler {
  constructor() {
    super();
    this._jobs = new Map(); // key → { key, schedule, payload, paused, history[] }
  }

  async health() {
    const all = [...this._jobs.values()];
    return {
      active: all.filter(j => !j.paused).length,
      paused: all.filter(j => j.paused).length,
      total: all.length,
    };
  }

  async listJobs() {
    return [...this._jobs.values()].map(j => ({
      key: j.key, schedule: j.schedule, paused: j.paused,
    }));
  }

  async triggerJob(key) {
    const job = this._jobs.get(key);
    if (!job) return { ok: false, error: "job not found" };
    const result = { mock: true, triggeredAt: Date.now(), key };
    job.history.push(result);
    return { ok: true, result };
  }

  async pauseJob(key) {
    const job = this._jobs.get(key);
    if (!job) return false;
    job.paused = true;
    return true;
  }

  async resumeJob(key) {
    const job = this._jobs.get(key);
    if (!job) return false;
    job.paused = false;
    return true;
  }

  async jobHistory() {
    return [...this._jobs.values()].flatMap(j => j.history);
  }

  // Test-only — register a job for triggerJob to find
  registerJob(key, schedule = "manual", payload = null) {
    this._jobs.set(key, { key, schedule, payload, paused: false, history: [] });
  }
}

module.exports = { InMemoryJobScheduler };
