/**
 * manage_jobs — use cases for cron job management via IJobScheduler.
 *
 * Each function takes the scheduler as an injected dependency so the
 * domain layer stays I/O free and the tests can use mocks.
 */

async function listJobs({ jobScheduler }) {
  if (!jobScheduler) throw new Error("listJobs: jobScheduler is required");
  return jobScheduler.listJobs();
}

async function triggerJob({ jobScheduler, key }) {
  if (!jobScheduler) throw new Error("triggerJob: jobScheduler is required");
  if (!key) return { ok: false, error: "key is required" };
  return jobScheduler.triggerJob(key);
}

async function pauseJob({ jobScheduler, key }) {
  if (!jobScheduler) throw new Error("pauseJob: jobScheduler is required");
  if (!key) return false;
  return jobScheduler.pauseJob(key);
}

async function resumeJob({ jobScheduler, key }) {
  if (!jobScheduler) throw new Error("resumeJob: jobScheduler is required");
  if (!key) return false;
  return jobScheduler.resumeJob(key);
}

async function getJobHistory({ jobScheduler }) {
  if (!jobScheduler) throw new Error("getJobHistory: jobScheduler is required");
  return jobScheduler.jobHistory();
}

module.exports = { listJobs, triggerJob, pauseJob, resumeJob, getJobHistory };
