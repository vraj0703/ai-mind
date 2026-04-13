/**
 * Plan — an operational plan with tasks and dependencies.
 *
 * Plans are TOML files in plans/. Mind's supervisor evaluates them,
 * builds execution waves, and dispatches unblocked tasks.
 */

const VALID_TASK_STATUSES = ["pending", "in-progress", "done", "deferred", "blocked"];

class Task {
  /**
   * @param {object} raw
   * @param {string} raw.id          - e.g. "D0-T1"
   * @param {string} raw.title
   * @param {string} [raw.status="pending"]
   * @param {string} [raw.owner]     - "pm" | "mr-v" | "sherpa:<name>" | "cortex"
   * @param {string[]} [raw.depends] - IDs of tasks this depends on
   * @param {number} [raw.score]     - priority score (0-100)
   */
  constructor(raw) {
    if (!raw.id || typeof raw.id !== "string") throw new Error("Task id is required");
    if (!raw.title || typeof raw.title !== "string") throw new Error("Task title is required");

    this.id = raw.id;
    this.title = raw.title;
    this.status = VALID_TASK_STATUSES.includes(raw.status) ? raw.status : "pending";
    this.owner = raw.owner || null;
    this.depends = Array.isArray(raw.depends) ? raw.depends : [];
    this.score = typeof raw.score === "number" ? raw.score : 0;
  }

  isDone() {
    return this.status === "done";
  }

  isActionable() {
    return this.status === "pending" || this.status === "in-progress";
  }

  isBlocked() {
    return this.status === "blocked" || this.status === "deferred";
  }
}

class Plan {
  /**
   * @param {object} raw
   * @param {string} raw.id          - plan filename stem, e.g. "raj-sadan-master-plan"
   * @param {string} raw.title
   * @param {string} [raw.status="active"]
   * @param {Task[]} [raw.tasks]
   */
  constructor(raw) {
    if (!raw.id || typeof raw.id !== "string") throw new Error("Plan id is required");
    if (!raw.title || typeof raw.title !== "string") throw new Error("Plan title is required");

    this.id = raw.id;
    this.title = raw.title;
    this.status = raw.status || "active";
    this.tasks = (raw.tasks || []).map(t => t instanceof Task ? t : new Task(t));
  }

  getActionableTasks() {
    return this.tasks.filter(t => t.isActionable());
  }

  getUnblockedTasks(completedIds) {
    const done = new Set(completedIds || this.tasks.filter(t => t.isDone()).map(t => t.id));
    return this.getActionableTasks().filter(task =>
      task.depends.every(depId => done.has(depId))
    );
  }

  progress() {
    const total = this.tasks.length;
    if (total === 0) return { total: 0, done: 0, pct: 0 };
    const done = this.tasks.filter(t => t.isDone()).length;
    return { total, done, pct: Math.round((done / total) * 100) };
  }
}

module.exports = { Plan, Task, VALID_TASK_STATUSES };
