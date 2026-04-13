/**
 * TaskScore — a scored task, ready for the morning focus brief.
 *
 * Pure data shape with validation. Produced by the generate_focus_brief
 * use case from (Plan, Task) inputs plus the scoring config.
 */

const VALID_URGENCIES = ["low", "normal", "soon", "urgent", "overdue"];

class TaskScore {
  /**
   * @param {object} raw
   * @param {string} raw.taskId
   * @param {string} [raw.taskTitle]
   * @param {string} raw.planId
   * @param {string} [raw.planName]
   * @param {number} raw.score       - clamped to 0..100
   * @param {string} [raw.urgency]   - one of VALID_URGENCIES
   * @param {number} [raw.effortHours]
   * @param {string} [raw.status]    - pending | in-progress | blocked | ...
   * @param {string} [raw.owner]
   * @param {string[]} [raw.reasons] - why this task scored this way
   * @param {object} [raw.components] - raw component breakdown for debugging
   */
  constructor(raw) {
    if (!raw || typeof raw !== "object") throw new Error("TaskScore: raw required");
    if (!raw.taskId) throw new Error("TaskScore: taskId required");
    if (!raw.planId) throw new Error("TaskScore: planId required");
    if (typeof raw.score !== "number" || Number.isNaN(raw.score)) {
      throw new Error("TaskScore: score must be number");
    }

    this.taskId = raw.taskId;
    this.taskTitle = raw.taskTitle || raw.taskId;
    this.planId = raw.planId;
    this.planName = raw.planName || raw.planId;
    this.score = Math.max(0, Math.min(100, raw.score));
    this.urgency = VALID_URGENCIES.includes(raw.urgency) ? raw.urgency : "normal";
    this.effortHours = typeof raw.effortHours === "number" ? raw.effortHours : null;
    this.status = raw.status || "pending";
    this.owner = raw.owner || null;
    this.reasons = Array.isArray(raw.reasons) ? raw.reasons.slice() : [];
    this.components = raw.components || null;
  }

  toJSON() {
    return {
      taskId: this.taskId,
      taskTitle: this.taskTitle,
      planId: this.planId,
      planName: this.planName,
      score: this.score,
      urgency: this.urgency,
      effortHours: this.effortHours,
      status: this.status,
      owner: this.owner,
      reasons: this.reasons,
    };
  }
}

module.exports = { TaskScore, VALID_URGENCIES };
