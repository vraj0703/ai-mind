/**
 * InMemoryPlanStore — default in-tree mock for IPlanStore.
 *
 * Holds plans in a Map. Empty by default; accepts seed via constructor for
 * tests. No filesystem, no TOML parsing, no PROJECT_ROOT assumption.
 */

const { IPlanStore } = require("../../../domain/repositories/i_plan_store");

class InMemoryPlanStore extends IPlanStore {
  constructor(opts = {}) {
    super();
    this._plans = new Map();
    for (const plan of opts.seed || []) {
      this._plans.set(plan.id, plan);
    }
  }

  async loadAll() {
    return [...this._plans.values()];
  }

  async loadById(planId) {
    return this._plans.get(planId) || null;
  }

  async updateTaskStatus(planId, taskId, newStatus) {
    const plan = this._plans.get(planId);
    if (!plan || !Array.isArray(plan.tasks)) return false;
    const task = plan.tasks.find(t => t.id === taskId);
    if (!task) return false;
    task.status = newStatus;
    return true;
  }
}

module.exports = { InMemoryPlanStore };
