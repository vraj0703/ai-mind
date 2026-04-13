/**
 * generate_focus_brief.js — Morning Focus Brief use case.
 *
 * Ported from v1 mind/focus/brief.js. Pure function: reads all plans via an
 * IPlanStore, scores every actionable task using weights from scoring.toml,
 * and returns the top N plus a WhatsApp-ready formatted string.
 *
 * The caller (mind's presentation layer, or a cron job) decides how to
 * actually deliver the brief — this use case does NO I/O beyond the
 * injected plan store. It does not call WhatsApp, NextCloud, or anything
 * else directly.
 *
 * Authority: plans/pm-focus-system.toml (T3)
 */

const fs = require("fs");
const path = require("path");
const { TaskScore } = require("../entities/task_score");

// ─── Scoring config loader ───────────────────────────────────────────────────

let SCORING_CONFIG = null;

/**
 * Load scoring.toml once at first use. Falls back to built-in defaults if
 * the file is missing or unparseable so the use case stays pure and
 * testable without filesystem state.
 * @returns {object}
 */
function _loadScoringConfig() {
  if (SCORING_CONFIG) return SCORING_CONFIG;
  try {
    const TOML = require("smol-toml");
    const configPath = path.join(__dirname, "..", "constants", "scoring.toml");
    const content = fs.readFileSync(configPath, "utf-8");
    SCORING_CONFIG = TOML.parse(content);
  } catch (_err) {
    SCORING_CONFIG = _defaultConfig();
  }
  return SCORING_CONFIG;
}

function _defaultConfig() {
  return {
    weights: {
      urgency: 25,
      dependency_impact: 20,
      owner_boost: 20,
      domain_priority: 15,
      staleness: 10,
      cascade_bonus: 10,
    },
    urgency: {
      horizon_days: 60,
      overdue_score: 1.0,
      critical_days: 7,
      warning_days: 14,
      normal_days: 30,
    },
    dependency_impact: { max_blocked: 5 },
    owner_boost: {
      pm_owner: 1.0,
      resident_input: 1.0,
      mr_v_owner: 0.3,
      minister_owner: 0.0,
      sherpa_owner: 0.0,
    },
    domain_priority: { critical: 1.0, high: 0.7, medium: 0.4, low: 0.1 },
    staleness: { max_stale_days: 14 },
    cascade_bonus: { threshold: 3, max_chain: 8 },
    filters: {
      include_statuses: ["pending", "in-progress", "in_progress", "blocked"],
      exclude_statuses: ["done", "completed", "skipped", "deferred"],
      include_plan_statuses: ["active", "draft"],
      min_score_for_brief: 20,
      max_brief_items: 5,
    },
  };
}

/** Reset cached config (test helper). */
function _resetScoringConfig() {
  SCORING_CONFIG = null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _dependencyCounts(plan) {
  // Build "task id -> number of other tasks that depend on it"
  const counts = new Map();
  for (const t of plan.tasks || []) counts.set(t.id, 0);
  for (const t of plan.tasks || []) {
    for (const depId of t.depends || t.depends_on || []) {
      if (counts.has(depId)) counts.set(depId, counts.get(depId) + 1);
    }
  }
  return counts;
}

function _ownerBoost(owner, cfg) {
  if (!owner) return 0;
  const map = cfg.owner_boost || {};
  const o = String(owner).toLowerCase();
  if (o === "pm") return map.pm_owner ?? 1.0;
  if (o === "mr-v" || o === "mrv") return map.mr_v_owner ?? 0.3;
  if (o.startsWith("minister")) return map.minister_owner ?? 0.0;
  if (o.startsWith("sherpa")) return map.sherpa_owner ?? 0.0;
  return 0;
}

function _planPriority(plan) {
  // Prefer explicit meta.priority if the data source attached it; otherwise
  // fall back to plan.priority, else "medium".
  const p = plan.priority || plan.meta?.priority || "medium";
  return String(p).toLowerCase();
}

function _deadline(plan) {
  const raw = plan.deadline || plan.context?.deadline || plan.meta?.deadline;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function _isActionable(task, cfg) {
  const status = String(task.status || "pending").toLowerCase();
  const include = (cfg.filters?.include_statuses || []).map(s => s.toLowerCase());
  const exclude = (cfg.filters?.exclude_statuses || []).map(s => s.toLowerCase());
  if (exclude.includes(status)) return false;
  if (include.length && !include.includes(status)) return false;
  return true;
}

function _isActivePlan(plan, cfg) {
  const status = String(plan.status || "active").toLowerCase();
  const include = (cfg.filters?.include_plan_statuses || ["active", "draft"]).map(s => s.toLowerCase());
  return include.includes(status);
}

// ─── Core scoring ────────────────────────────────────────────────────────────

/**
 * Score a single task within its plan. Returns raw components + a final
 * 0..100 score, urgency label, and human-readable reasons.
 *
 * @param {object} task - v2 Task entity or plain {id, title, status, owner, depends, score, ...}
 * @param {object} plan - v2 Plan entity or plain {id, title, status, tasks, ...}
 * @param {object} [opts]
 * @param {Map<string, number>} [opts.depCounts] - precomputed dependents per task id
 * @param {Date}   [opts.today]                  - injectable clock for tests
 * @param {object} [opts.config]                 - scoring config override
 * @returns {{score: number, urgency: string, reasons: string[], components: object}}
 */
function _scoreTask(task, plan, opts = {}) {
  const cfg = opts.config || _loadScoringConfig();
  const today = opts.today || new Date();
  const w = cfg.weights || {};

  // 1. Urgency — from plan deadline
  const deadline = _deadline(plan);
  let urgencyRaw = 0;
  let urgencyLabel = "low";
  if (deadline) {
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
    const horizon = cfg.urgency?.horizon_days ?? 60;
    if (daysLeft <= 0) {
      urgencyRaw = cfg.urgency?.overdue_score ?? 1.0;
      urgencyLabel = "overdue";
    } else {
      urgencyRaw = Math.max(0, 1 - daysLeft / horizon);
      if (daysLeft <= (cfg.urgency?.critical_days ?? 7)) urgencyLabel = "urgent";
      else if (daysLeft <= (cfg.urgency?.warning_days ?? 14)) urgencyLabel = "soon";
      else if (daysLeft <= (cfg.urgency?.normal_days ?? 30)) urgencyLabel = "normal";
      else urgencyLabel = "low";
    }
  }

  // 2. Dependency impact — how many tasks depend on this one
  const depCounts = opts.depCounts || _dependencyCounts(plan);
  const blocked = depCounts.get(task.id) || 0;
  const maxBlocked = cfg.dependency_impact?.max_blocked ?? 5;
  const depRaw = Math.min(1, blocked / maxBlocked);

  // 3. Owner boost
  const ownerRaw = _ownerBoost(task.owner, cfg);

  // 4. Domain priority (plan-level)
  const planPrio = _planPriority(plan);
  const domainMap = cfg.domain_priority || {};
  const domainRaw = domainMap[planPrio] ?? 0.4;

  // 5. Staleness — task.score on the v2 entity doubles as "days stale since
  //    last update" is not tracked yet, so we approximate using in-progress
  //    status (momentum) as the inverse signal. Keep contribution conservative.
  let staleRaw = 0;
  const status = String(task.status || "pending").toLowerCase();
  if (status === "pending") staleRaw = 0.3;
  if (status === "blocked") staleRaw = 0.8;
  if (status === "in-progress" || status === "in_progress") staleRaw = 0.0;

  // 6. Cascade bonus — reuse dependency count as a rough proxy for chain
  const cascadeThreshold = cfg.cascade_bonus?.threshold ?? 3;
  const cascadeMax = cfg.cascade_bonus?.max_chain ?? 8;
  const cascadeRaw = blocked >= cascadeThreshold ? Math.min(1, blocked / cascadeMax) : 0;

  // 7. Task-level priority nudge (v2 Task.score is populated from raw "priority")
  const baseScore = typeof task.score === "number" ? task.score : 0;

  const components = {
    urgency:    urgencyRaw * (w.urgency ?? 25),
    dependency: depRaw     * (w.dependency_impact ?? 20),
    owner:      ownerRaw   * (w.owner_boost ?? 20),
    domain:     domainRaw  * (w.domain_priority ?? 15),
    staleness:  staleRaw   * (w.staleness ?? 10),
    cascade:    cascadeRaw * (w.cascade_bonus ?? 10),
    base:       Math.max(0, Math.min(10, baseScore / 10)), // small nudge, capped
  };

  const total = Object.values(components).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, total));

  // Human-readable reasons
  const reasons = [];
  if (ownerRaw >= 1.0) reasons.push("needs your input");
  if (urgencyLabel === "overdue") reasons.push("plan overdue");
  else if (urgencyLabel === "urgent") reasons.push("deadline within 7 days");
  if (blocked > 0) reasons.push(`blocks ${blocked} task${blocked === 1 ? "" : "s"}`);
  if (status === "in-progress" || status === "in_progress") reasons.push("already in progress");
  if (status === "blocked") reasons.push("blocked — needs unblock");
  if (planPrio === "critical") reasons.push("critical-priority plan");

  return { score, urgency: urgencyLabel, reasons, components };
}

// ─── Formatter ───────────────────────────────────────────────────────────────

function _formatBrief(topTasks, { date, totalPending, pmBlocked } = {}) {
  const lines = [];
  const dateStr = (date || new Date()).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  lines.push(`Focus Brief — ${dateStr}`);
  lines.push("");

  if (topTasks.length === 0) {
    lines.push("No actionable tasks above threshold.");
  } else {
    lines.push(`Your top ${topTasks.length} item${topTasks.length === 1 ? "" : "s"} today:`);
    lines.push("");
    topTasks.forEach((t, i) => {
      lines.push(`${i + 1}. [${t.urgency.toUpperCase()}] ${t.taskTitle}  (${t.score.toFixed(0)})`);
      lines.push(`   ${t.planName} | ${t.planId}:${t.taskId}`);
      if (t.reasons.length > 0) {
        lines.push(`   Why: ${t.reasons.join("; ")}`);
      }
      if (i < topTasks.length - 1) lines.push("");
    });
  }

  if (typeof totalPending === "number") {
    lines.push("");
    lines.push(`${totalPending} tasks pending | ${pmBlocked ?? 0} waiting on you`);
  }

  return lines.join("\n");
}

// ─── Public use case ─────────────────────────────────────────────────────────

/**
 * Generate a morning focus brief across all active plans.
 *
 * Pure: calls only planStore.loadAll() and then computes. Returns a
 * structured result. The caller delivers the brief (WhatsApp, stdout,
 * file, HTTP response, etc).
 *
 * @param {object} deps
 * @param {import('../repositories/i_plan_store').IPlanStore} deps.planStore
 * @param {number} [deps.topN]        - max items in brief (default from config or 5)
 * @param {number} [deps.minScore]    - filter threshold (default from config or 20)
 * @param {Date}   [deps.today]       - injectable clock
 * @param {object} [deps.config]      - override scoring config (tests)
 * @returns {Promise<{
 *   timestamp: string,
 *   topTasks: TaskScore[],
 *   allScored: TaskScore[],
 *   stats: {totalPending: number, pmBlocked: number, plansActive: number},
 *   formatted: string,
 * }>}
 */
async function generateFocusBrief({ planStore, topN, minScore, today, config } = {}) {
  if (!planStore) throw new Error("generateFocusBrief: planStore required");
  const cfg = config || _loadScoringConfig();
  const limit = typeof topN === "number" ? topN : (cfg.filters?.max_brief_items ?? 5);
  const threshold = typeof minScore === "number" ? minScore : (cfg.filters?.min_score_for_brief ?? 20);
  const clock = today || new Date();

  const plans = await planStore.loadAll();
  const activePlans = plans.filter(p => _isActivePlan(p, cfg));

  const allScored = [];
  let totalPending = 0;
  let pmBlocked = 0;

  for (const plan of activePlans) {
    const depCounts = _dependencyCounts(plan);
    for (const task of plan.tasks || []) {
      if (!_isActionable(task, cfg)) continue;
      totalPending++;
      if (String(task.owner || "").toLowerCase() === "pm") pmBlocked++;

      const { score, urgency, reasons, components } = _scoreTask(task, plan, {
        config: cfg,
        today: clock,
        depCounts,
      });

      allScored.push(new TaskScore({
        taskId: task.id,
        taskTitle: task.title || task.id,
        planId: plan.id,
        planName: plan.title || plan.id,
        score,
        urgency,
        status: task.status,
        owner: task.owner || null,
        reasons,
        components,
      }));
    }
  }

  // Sort by score descending, then by urgency, then by title for determinism
  allScored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.taskTitle.localeCompare(b.taskTitle);
  });

  const topTasks = allScored
    .filter(t => t.score >= threshold)
    .slice(0, limit);

  const stats = {
    totalPending,
    pmBlocked,
    plansActive: activePlans.length,
  };

  const formatted = _formatBrief(topTasks, {
    date: clock,
    totalPending,
    pmBlocked,
  });

  return {
    timestamp: clock.toISOString(),
    topTasks,
    allScored,
    stats,
    formatted,
  };
}

module.exports = {
  generateFocusBrief,
  // Exposed for tests:
  _scoreTask,
  _loadScoringConfig,
  _resetScoringConfig,
  _formatBrief,
  _defaultConfig,
};
