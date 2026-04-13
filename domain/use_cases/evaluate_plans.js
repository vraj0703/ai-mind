/**
 * EvaluatePlans — resolve plan dependencies and build execution waves.
 *
 * A "wave" is a group of tasks that can run in parallel because all
 * their dependencies are satisfied. Wave 0 = no deps. Wave 1 = deps
 * all in Wave 0. And so on. This is a topological sort.
 *
 * Pure logic. No I/O. Caller uses IPlanStore to load plans, this function
 * just does the math.
 */

const { PlanCycleDetected } = require("../exceptions");
const { MIN_TASK_SCORE_FOR_EXECUTION } = require("../constants");

/**
 * Build execution waves from a flat list of tasks.
 *
 * @param {import('../entities/plan').Task[]} tasks
 * @returns {import('../entities/plan').Task[][]} - array of waves, each wave is tasks that can run in parallel
 * @throws {PlanCycleDetected} if a dependency cycle is found
 */
function buildWaves(tasks) {
  const actionable = tasks.filter(t => t.isActionable());
  const doneIds = new Set(tasks.filter(t => t.isDone()).map(t => t.id));
  const placed = new Set();
  const waves = [];

  let remaining = actionable.length;
  let lastRemaining = -1;

  while (remaining > 0) {
    if (remaining === lastRemaining) {
      // No progress — cycle detected
      const stuck = actionable
        .filter(t => !placed.has(t.id))
        .map(t => t.id);
      throw new PlanCycleDetected("unknown", stuck);
    }
    lastRemaining = remaining;

    const wave = [];
    for (const task of actionable) {
      if (placed.has(task.id)) continue;
      const depsResolved = task.depends.every(
        depId => doneIds.has(depId) || placed.has(depId)
      );
      if (depsResolved) {
        wave.push(task);
      }
    }

    if (wave.length > 0) {
      waves.push(wave);
      for (const t of wave) placed.add(t.id);
      remaining -= wave.length;
    }
  }

  return waves;
}

/**
 * From all plans, find the next executable tasks (Wave 0 across all plans).
 *
 * @param {import('../entities/plan').Plan[]} plans
 * @param {object} [opts]
 * @param {number} [opts.minScore] - minimum task score to include
 * @param {number} [opts.maxTasks] - max tasks to return
 * @returns {{ planId: string, task: import('../entities/plan').Task }[]}
 */
function findNextTasks(plans, opts = {}) {
  const minScore = opts.minScore ?? MIN_TASK_SCORE_FOR_EXECUTION;
  const maxTasks = opts.maxTasks ?? 5;
  const candidates = [];

  for (const plan of plans) {
    if (plan.status !== "active") continue;
    try {
      const waves = buildWaves(plan.tasks);
      if (waves.length > 0) {
        for (const task of waves[0]) {
          if (task.score >= minScore) {
            candidates.push({ planId: plan.id, task });
          }
        }
      }
    } catch (e) {
      if (e.name === "PlanCycleDetected") continue; // skip cyclic plans
      throw e;
    }
  }

  // Sort by score descending, take top N
  candidates.sort((a, b) => b.task.score - a.task.score);
  return candidates.slice(0, maxTasks);
}

module.exports = { buildWaves, findNextTasks };
