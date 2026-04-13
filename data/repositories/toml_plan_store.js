/**
 * TOMLPlanStore — concrete IPlanStore reading from plans/*.toml files.
 */

const fs = require("fs");
const path = require("path");
const { IPlanStore } = require("../../domain/repositories/i_plan_store");
const { Plan, Task } = require("../../domain/entities/plan");
const { readToml } = require("../data_sources/local/toml_file");

class TOMLPlanStore extends IPlanStore {
  constructor(opts = {}) {
    super();
    this.plansDir = opts.plansDir || path.resolve(process.cwd(), "plans");
  }

  async loadAll() {
    if (!fs.existsSync(this.plansDir)) return [];
    const files = fs.readdirSync(this.plansDir).filter(f => f.endsWith(".toml"));
    const plans = [];

    for (const file of files) {
      try {
        const plan = this._parsePlanFile(path.join(this.plansDir, file));
        if (plan) plans.push(plan);
      } catch (err) {
        // Skip malformed plans
      }
    }

    return plans;
  }

  async loadById(planId) {
    const filePath = path.join(this.plansDir, `${planId}.toml`);
    if (!fs.existsSync(filePath)) return null;
    return this._parsePlanFile(filePath);
  }

  async updateTaskStatus(planId, taskId, newStatus) {
    const filePath = path.join(this.plansDir, `${planId}.toml`);
    if (!fs.existsSync(filePath)) return false;

    let content = fs.readFileSync(filePath, "utf-8");
    // Find the task by ID and update its status field
    // Plans use pattern: id = "D0-T1" followed by status = "pending"
    const taskPattern = new RegExp(
      `(id\\s*=\\s*"${taskId}"[\\s\\S]*?status\\s*=\\s*)"[^"]*"`,
    );
    if (!taskPattern.test(content)) return false;

    content = content.replace(taskPattern, `$1"${newStatus}"`);
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  }

  _parsePlanFile(filePath) {
    const data = readToml(filePath);
    if (!data) return null;

    const meta = data.meta || data.plan || {};
    const planId = meta.id || path.basename(filePath, ".toml");
    const title = meta.title || meta.name || planId;
    const status = meta.status || "active";

    // Extract tasks from sections like [deliverables.D0.tasks.T1]
    const tasks = [];
    const deliverables = data.deliverables || data.phases || {};

    for (const [dKey, deliverable] of Object.entries(deliverables)) {
      if (!deliverable || typeof deliverable !== "object") continue;
      const taskMap = deliverable.tasks || deliverable;

      for (const [tKey, tData] of Object.entries(taskMap)) {
        if (!tData || typeof tData !== "object" || !tData.title) continue;
        tasks.push(new Task({
          id: tData.id || `${dKey}-${tKey}`,
          title: tData.title,
          status: tData.status || "pending",
          owner: tData.owner || null,
          depends: tData.depends || tData.dependencies || [],
          score: tData.score || tData.priority || 0,
        }));
      }
    }

    return new Plan({ id: planId, title, status, tasks });
  }
}

module.exports = { TOMLPlanStore };
