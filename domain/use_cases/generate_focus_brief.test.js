const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");

const {
  generateFocusBrief,
  _scoreTask,
  _defaultConfig,
  _resetScoringConfig,
} = require("./generate_focus_brief");
const { TaskScore } = require("../entities/task_score");
const { Plan, Task } = require("../entities/plan");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkTask(id, opts = {}) {
  return new Task({ id, title: `Task ${id}`, ...opts });
}

function mkPlan(id, tasks, extras = {}) {
  const plan = new Plan({
    id,
    title: extras.title || `Plan ${id}`,
    status: extras.status || "active",
    tasks,
  });
  // Attach non-entity fields the use case reads defensively.
  if (extras.priority) plan.priority = extras.priority;
  if (extras.deadline) plan.deadline = extras.deadline;
  return plan;
}

class FakePlanStore {
  constructor(plans) { this.plans = plans; }
  async loadAll() { return this.plans; }
  async loadById(id) { return this.plans.find(p => p.id === id) || null; }
  async updateTaskStatus() { return true; }
}

const FIXED_TODAY = new Date("2026-04-11T08:00:00+05:30");
const CONFIG = _defaultConfig();

beforeEach(() => { _resetScoringConfig(); });

// ─── TaskScore entity ────────────────────────────────────────────────────────

describe("TaskScore entity", () => {
  it("requires taskId and planId", () => {
    assert.throws(() => new TaskScore({ score: 50, planId: "p" }), /taskId/);
    assert.throws(() => new TaskScore({ score: 50, taskId: "t" }), /planId/);
  });

  it("requires numeric score", () => {
    assert.throws(
      () => new TaskScore({ taskId: "t", planId: "p", score: "high" }),
      /score must be number/
    );
  });

  it("clamps score to 0..100", () => {
    const a = new TaskScore({ taskId: "t", planId: "p", score: 150 });
    const b = new TaskScore({ taskId: "t", planId: "p", score: -20 });
    assert.strictEqual(a.score, 100);
    assert.strictEqual(b.score, 0);
  });

  it("defaults urgency, reasons, status", () => {
    const s = new TaskScore({ taskId: "t", planId: "p", score: 50 });
    assert.strictEqual(s.urgency, "normal");
    assert.deepStrictEqual(s.reasons, []);
    assert.strictEqual(s.status, "pending");
  });

  it("serializes via toJSON", () => {
    const s = new TaskScore({
      taskId: "T1", planId: "P1", score: 42, reasons: ["x"],
    });
    const j = s.toJSON();
    assert.strictEqual(j.taskId, "T1");
    assert.strictEqual(j.score, 42);
    assert.deepStrictEqual(j.reasons, ["x"]);
  });
});

// ─── _scoreTask ──────────────────────────────────────────────────────────────

describe("_scoreTask", () => {
  it("gives pm-owned tasks a big owner boost", () => {
    const plan = mkPlan("p1", [mkTask("T1", { owner: "pm" })]);
    const pmTask = plan.tasks[0];
    const otherPlan = mkPlan("p2", [mkTask("T2", { owner: "minister-design" })]);
    const otherTask = otherPlan.tasks[0];

    const pmResult = _scoreTask(pmTask, plan, { config: CONFIG, today: FIXED_TODAY });
    const otherResult = _scoreTask(otherTask, otherPlan, { config: CONFIG, today: FIXED_TODAY });

    assert.ok(pmResult.score > otherResult.score,
      `expected pm task (${pmResult.score}) > minister task (${otherResult.score})`);
    assert.ok(pmResult.reasons.includes("needs your input"));
  });

  it("scores overdue plans as urgency=overdue", () => {
    const plan = mkPlan("p1", [mkTask("T1")], {
      deadline: "2026-01-01",
      priority: "high",
    });
    const r = _scoreTask(plan.tasks[0], plan, { config: CONFIG, today: FIXED_TODAY });
    assert.strictEqual(r.urgency, "overdue");
    assert.ok(r.reasons.includes("plan overdue"));
  });

  it("scores deadlines within 7 days as urgency=urgent", () => {
    const plan = mkPlan("p1", [mkTask("T1")], { deadline: "2026-04-15" });
    const r = _scoreTask(plan.tasks[0], plan, { config: CONFIG, today: FIXED_TODAY });
    assert.strictEqual(r.urgency, "urgent");
  });

  it("awards dependency impact based on how many tasks depend on it", () => {
    const plan = mkPlan("p1", [
      mkTask("A"),
      mkTask("B", { depends: ["A"] }),
      mkTask("C", { depends: ["A"] }),
      mkTask("D", { depends: ["A"] }),
    ]);
    const aScore = _scoreTask(plan.tasks[0], plan, { config: CONFIG, today: FIXED_TODAY });
    const dScore = _scoreTask(plan.tasks[3], plan, { config: CONFIG, today: FIXED_TODAY });
    assert.ok(aScore.score > dScore.score);
    assert.ok(aScore.reasons.some(r => r.includes("blocks 3")));
  });

  it("gives critical-priority plans a domain boost", () => {
    const hi = mkPlan("hi", [mkTask("T1")], { priority: "critical" });
    const lo = mkPlan("lo", [mkTask("T1")], { priority: "low" });
    const hiR = _scoreTask(hi.tasks[0], hi, { config: CONFIG, today: FIXED_TODAY });
    const loR = _scoreTask(lo.tasks[0], lo, { config: CONFIG, today: FIXED_TODAY });
    assert.ok(hiR.score > loR.score);
  });

  it("in-progress tasks do not accumulate staleness", () => {
    const inProg = mkPlan("p", [mkTask("T1", { status: "in-progress" })]);
    const pending = mkPlan("p", [mkTask("T1", { status: "pending" })]);
    const ipR = _scoreTask(inProg.tasks[0], inProg, { config: CONFIG, today: FIXED_TODAY });
    const pR = _scoreTask(pending.tasks[0], pending, { config: CONFIG, today: FIXED_TODAY });
    // staleness component of pending > staleness of in-progress (0)
    assert.ok(pR.components.staleness >= ipR.components.staleness);
    assert.ok(ipR.reasons.includes("already in progress"));
  });
});

// ─── generateFocusBrief ──────────────────────────────────────────────────────

describe("generateFocusBrief", () => {
  it("requires a planStore", async () => {
    await assert.rejects(() => generateFocusBrief({}), /planStore required/);
  });

  it("returns empty topTasks when there are no plans", async () => {
    const store = new FakePlanStore([]);
    const result = await generateFocusBrief({ planStore: store, today: FIXED_TODAY });
    assert.strictEqual(result.topTasks.length, 0);
    assert.strictEqual(result.stats.totalPending, 0);
    assert.match(result.formatted, /No actionable tasks/);
  });

  it("skips non-active plans", async () => {
    const active = mkPlan("a", [mkTask("T1", { owner: "pm" })]);
    const archived = mkPlan("b", [mkTask("T2", { owner: "pm" })], { status: "archived" });
    const store = new FakePlanStore([active, archived]);
    const result = await generateFocusBrief({ planStore: store, today: FIXED_TODAY });
    assert.strictEqual(result.stats.plansActive, 1);
    assert.strictEqual(result.allScored.length, 1);
    assert.strictEqual(result.allScored[0].planId, "a");
  });

  it("skips done/completed tasks", async () => {
    const plan = mkPlan("p", [
      mkTask("T1", { status: "done" }),
      mkTask("T2", { status: "pending", owner: "pm" }),
    ]);
    const store = new FakePlanStore([plan]);
    const result = await generateFocusBrief({ planStore: store, today: FIXED_TODAY });
    assert.strictEqual(result.allScored.length, 1);
    assert.strictEqual(result.allScored[0].taskId, "T2");
  });

  it("sorts by score descending and takes top N", async () => {
    const plan = mkPlan("p", [
      mkTask("LOW", { owner: "minister-design" }),
      mkTask("HIGH", { owner: "pm" }),
      mkTask("MID", { owner: "mr-v" }),
    ], { priority: "critical", deadline: "2026-04-15" });
    const store = new FakePlanStore([plan]);
    const result = await generateFocusBrief({
      planStore: store, topN: 2, today: FIXED_TODAY, minScore: 0,
    });
    assert.strictEqual(result.topTasks.length, 2);
    assert.strictEqual(result.topTasks[0].taskId, "HIGH");
    // second place should be MID (mr-v > minister owner boost)
    assert.strictEqual(result.topTasks[1].taskId, "MID");
    // descending
    assert.ok(result.topTasks[0].score >= result.topTasks[1].score);
  });

  it("filters below minScore", async () => {
    const plan = mkPlan("p", [mkTask("T1", { owner: "minister-design" })]);
    const store = new FakePlanStore([plan]);
    const result = await generateFocusBrief({
      planStore: store, today: FIXED_TODAY, minScore: 99,
    });
    assert.strictEqual(result.topTasks.length, 0);
    assert.ok(result.allScored.length >= 1); // scored but filtered
  });

  it("formatted output contains task titles and scores", async () => {
    const plan = mkPlan("p", [mkTask("T1", { owner: "pm" })], {
      priority: "critical", deadline: "2026-04-15", title: "Career Plan",
    });
    const store = new FakePlanStore([plan]);
    const result = await generateFocusBrief({
      planStore: store, today: FIXED_TODAY, minScore: 0,
    });
    assert.match(result.formatted, /Focus Brief/);
    assert.match(result.formatted, /Task T1/);
    assert.match(result.formatted, /Career Plan/);
    // score number appears in parens
    const top = result.topTasks[0];
    assert.ok(result.formatted.includes(top.score.toFixed(0)));
  });

  it("counts pm-blocked tasks in stats", async () => {
    const plan = mkPlan("p", [
      mkTask("T1", { owner: "pm", status: "pending" }),
      mkTask("T2", { owner: "pm", status: "pending" }),
      mkTask("T3", { owner: "mr-v", status: "pending" }),
    ]);
    const store = new FakePlanStore([plan]);
    const result = await generateFocusBrief({ planStore: store, today: FIXED_TODAY });
    assert.strictEqual(result.stats.totalPending, 3);
    assert.strictEqual(result.stats.pmBlocked, 2);
  });

  it("returns TaskScore instances in topTasks", async () => {
    const plan = mkPlan("p", [mkTask("T1", { owner: "pm" })]);
    const store = new FakePlanStore([plan]);
    const result = await generateFocusBrief({
      planStore: store, today: FIXED_TODAY, minScore: 0,
    });
    assert.ok(result.topTasks[0] instanceof TaskScore);
  });
});
