/**
 * IPlanStore — abstract interface for reading and updating plans.
 *
 * Mind's supervisor reads plans to evaluate tasks.
 * Mind's executor updates task statuses after completion.
 * The data layer decides whether plans are TOML files, a database, etc.
 *
 * Implementations: data/repositories/toml_plan_store.js
 */

class IPlanStore {
  /**
   * Load all plans.
   * @returns {Promise<import('../entities/plan').Plan[]>}
   */
  async loadAll() {
    throw new Error("IPlanStore.loadAll() not implemented");
  }

  /**
   * Load a single plan by ID.
   * @param {string} planId
   * @returns {Promise<import('../entities/plan').Plan | null>}
   */
  async loadById(planId) {
    throw new Error("IPlanStore.loadById() not implemented");
  }

  /**
   * Update a task's status within a plan.
   * @param {string} planId
   * @param {string} taskId
   * @param {string} newStatus - "done" | "in-progress" | "blocked" | "deferred"
   * @returns {Promise<boolean>} - true if the update was applied
   */
  async updateTaskStatus(planId, taskId, newStatus) {
    throw new Error("IPlanStore.updateTaskStatus() not implemented");
  }
}

module.exports = { IPlanStore };
