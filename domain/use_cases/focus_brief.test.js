const { describe, it } = require("node:test");
const assert = require("node:assert");
const { TaskScore, VALID_URGENCIES } = require("../entities/task_score");
const {
  generateFocusBrief,
  _scoreTask,
  _defaultConfig,
  _formatBrief,
} = require("./generate_focus_brief");

// ─── Mock IPlanStore ───

class MockPlanStore {
  constructor(plans = []) { this.plans = plans; }
  async loadAll() { return this.plans; }
  async getById(id) { return this.plans.find(p => p.id === id) || null; }
}

// ─── TaskScore entity ───

describe("TaskScore", () => {
  it("requires taskId and planId", () => {
    assert.throws(() => new TaskScore({ planId: "p", score: 50 }), /taskId required/);
    assert.throws(() => new TaskScore({ taskId: "t", score: 50 }), /planId required/);
  });

  it("requires numeric score", () => {
    assert.throws(() => new TaskScore({ taskId: "t", planId: "p" }), /score must be number/);
    assert.throws(() => new TaskScore({ taskId: "t", planId: "p", score: "50" }), /score must be number/);
  });

  it("clamps score to 0-100", () => {
    assert.strictEqual(new TaskScore({ taskId: "t", planId: "p", score: 150 }).score, 100);
    assert.strictEqual(new TaskScore({ taskId: "t", planId: "p", score: -10 }).score, 0);
  });

  it("defaults urgency to normal when invalid", () => {
    const s = new TaskScore({ taskId: "t", planId: "p", score: 50, urgency: "bogus" });
    assert.strictEqual(s.urgency, "normal");
  });

  it("accepts all valid urgencies", () => {
    for (const u of VALID_URGENCIES) {
      const s = new TaskScore({ taskId: "t", planId: "p", score: 50, urgency: u });
      assert.strictEqual(s.urgency, u);
    }
  });

  it("falls back taskTitle/planName to ids", () => {
    const s = new TaskScore({ taskId: "t1", planId: "p1", score: 50 });
    assert.strictEqual(s.taskTitle, "t1");
    assert.strictEqual(s.planName, "p1");
  });

  it("defensively copies reasons array", () => {
    const reasons = ["a", "b"];
    const s = new TaskScore({ taskId: "t", planId: "p", score: 50, reasons });
    reasons.push("c");
    assert.strictEqual(s.reasons.length, 2);
  });

  it("toJSON omits components", () => {
    const s = new TaskScore({ taskId: "t", planId: "p", score: 50, components: { urgency: 20 } });
    const json = s.toJSON();
    assert.ok(!("components" in json));
    assert.strictEqual(json.taskId, "t");
  });
});

// ─── _scoreTask individual scoring ───

describe("_scoreTask", () => {
  const cfg = _defaultConfig();

  it("PM-owned task gets max owner boost", () => {
    const plan = { id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", owner: "pm", status: "pending" }] };
    const { score, reasons } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    // owner weight = 20 * 1.0 = 20. Plus domain (medium 0.4 * 15 = 6). Plus staleness (0.3 * 10 = 3).
    assert.ok(score >= 20, `expected >= 20, got ${score}`);
    assert.ok(reasons.includes("needs your input"));
  });

  it("Mr V-owned task gets small boost", () => {
    const plan = { id: "p1", tasks: [{ id: "t1", owner: "mr-v", status: "pending" }] };
    const pmPlan = { id: "p2", tasks: [{ id: "t2", owner: "pm", status: "pending" }] };
    const mrScore = _scoreTask(plan.tasks[0], plan, { config: cfg }).score;
    const pmScore = _scoreTask(pmPlan.tasks[0], pmPlan, { config: cfg }).score;
    assert.ok(pmScore > mrScore, `PM (${pmScore}) should beat Mr-V (${mrScore})`);
  });

  it("overdue deadline triggers urgency overdue", () => {
    const yesterday = new Date(Date.now() - 86400000);
    const plan = { id: "p1", deadline: yesterday.toISOString(), tasks: [{ id: "t1", status: "pending" }] };
    const { urgency, reasons } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    assert.strictEqual(urgency, "overdue");
    assert.ok(reasons.includes("plan overdue"));
  });

  it("deadline within 7 days is urgent", () => {
    const soon = new Date(Date.now() + 3 * 86400000);
    const plan = { id: "p1", deadline: soon.toISOString(), tasks: [{ id: "t1", status: "pending" }] };
    const { urgency, reasons } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    assert.strictEqual(urgency, "urgent");
    assert.ok(reasons.includes("deadline within 7 days"));
  });

  it("blocked task surfaces in reasons + high staleness", () => {
    const plan = { id: "p1", tasks: [{ id: "t1", status: "blocked" }] };
    const { score, reasons } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    assert.ok(reasons.some(r => r.includes("blocked")));
    // staleness 0.8 * 10 = 8
    assert.ok(score >= 8);
  });

  it("in-progress task gets momentum credit (zero staleness + reason)", () => {
    const plan = { id: "p1", tasks: [{ id: "t1", status: "in-progress" }] };
    const { reasons } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    assert.ok(reasons.includes("already in progress"));
  });

  it("dependency impact: blocking many tasks boosts score", () => {
    const plan = {
      id: "p1",
      tasks: [
        { id: "t1", status: "pending" },
        { id: "t2", status: "pending", depends: ["t1"] },
        { id: "t3", status: "pending", depends: ["t1"] },
        { id: "t4", status: "pending", depends: ["t1"] },
        { id: "t5", status: "pending", depends: ["t1"] },
      ],
    };
    const { score, reasons } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    // t1 blocks 4 tasks. depRaw = 4/5 = 0.8. depRaw * 20 = 16.
    assert.ok(score >= 16, `expected >= 16, got ${score}`);
    assert.ok(reasons.some(r => r.includes("blocks 4 task")));
  });

  it("critical plan priority surfaces in reasons", () => {
    const plan = { id: "p1", priority: "critical", tasks: [{ id: "t1", status: "pending" }] };
    const { reasons } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    assert.ok(reasons.includes("critical-priority plan"));
  });

  it("clamps final score to 0-100 even with all boosts stacked", () => {
    const plan = {
      id: "p1",
      priority: "critical",
      deadline: new Date(Date.now() - 86400000).toISOString(),
      tasks: [
        { id: "t1", status: "blocked", owner: "pm", score: 95 },
        { id: "t2", status: "pending", depends: ["t1"] },
        { id: "t3", status: "pending", depends: ["t1"] },
        { id: "t4", status: "pending", depends: ["t1"] },
        { id: "t5", status: "pending", depends: ["t1"] },
        { id: "t6", status: "pending", depends: ["t1"] },
      ],
    };
    const { score } = _scoreTask(plan.tasks[0], plan, { config: cfg });
    assert.ok(score <= 100);
    assert.ok(score >= 70, `max-stacked should be high, got ${score}`);
  });
});

// ─── generateFocusBrief end-to-end ───

describe("generateFocusBrief", () => {
  it("throws if planStore missing", async () => {
    await assert.rejects(() => generateFocusBrief({}), /planStore required/);
  });

  it("returns empty top list when no plans", async () => {
    const store = new MockPlanStore([]);
    const result = await generateFocusBrief({ planStore: store });
    assert.strictEqual(result.topTasks.length, 0);
    assert.strictEqual(result.stats.plansActive, 0);
    assert.ok(result.formatted.includes("No actionable tasks"));
  });

  it("filters out archived/completed plans", async () => {
    const store = new MockPlanStore([
      { id: "p1", status: "active", tasks: [{ id: "t1", owner: "pm", status: "pending" }] },
      { id: "p2", status: "completed", tasks: [{ id: "t2", owner: "pm", status: "pending" }] },
      { id: "p3", status: "archived", tasks: [{ id: "t3", owner: "pm", status: "pending" }] },
    ]);
    const result = await generateFocusBrief({ planStore: store });
    assert.strictEqual(result.stats.plansActive, 1);
    assert.ok(result.allScored.every(t => t.planId === "p1"));
  });

  it("filters out completed tasks", async () => {
    const store = new MockPlanStore([{
      id: "p1", status: "active",
      tasks: [
        { id: "t1", owner: "pm", status: "pending" },
        { id: "t2", owner: "pm", status: "done" },
        { id: "t3", owner: "pm", status: "skipped" },
      ],
    }]);
    const result = await generateFocusBrief({ planStore: store });
    assert.strictEqual(result.allScored.length, 1);
    assert.strictEqual(result.allScored[0].taskId, "t1");
  });

  it("sorts by score descending", async () => {
    const store = new MockPlanStore([{
      id: "p1", status: "active",
      tasks: [
        { id: "low", status: "pending", owner: "sherpa-x" },
        { id: "high", status: "pending", owner: "pm" },
        { id: "mid", status: "pending", owner: "mr-v" },
      ],
    }]);
    const result = await generateFocusBrief({ planStore: store, minScore: 0 });
    assert.ok(result.allScored.length >= 3);
    for (let i = 1; i < result.allScored.length; i++) {
      assert.ok(result.allScored[i - 1].score >= result.allScored[i].score);
    }
  });

  it("respects topN limit", async () => {
    const store = new MockPlanStore([{
      id: "p1", status: "active",
      tasks: Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`, owner: "pm", status: "pending",
      })),
    }]);
    const result = await generateFocusBrief({ planStore: store, topN: 3, minScore: 0 });
    assert.strictEqual(result.topTasks.length, 3);
  });

  it("respects minScore filter", async () => {
    const store = new MockPlanStore([{
      id: "p1", status: "active",
      tasks: [
        { id: "t1", status: "pending", owner: "pm" },
        { id: "t2", status: "pending", owner: "sherpa-x" },
      ],
    }]);
    const result = await generateFocusBrief({ planStore: store, minScore: 15 });
    // only the pm task should clear the threshold
    assert.ok(result.topTasks.every(t => t.score >= 15));
  });

  it("stats tracks totalPending and pmBlocked", async () => {
    const store = new MockPlanStore([{
      id: "p1", status: "active",
      tasks: [
        { id: "t1", status: "pending", owner: "pm" },
        { id: "t2", status: "pending", owner: "pm" },
        { id: "t3", status: "pending", owner: "mr-v" },
      ],
    }]);
    const result = await generateFocusBrief({ planStore: store, minScore: 0 });
    assert.strictEqual(result.stats.totalPending, 3);
    assert.strictEqual(result.stats.pmBlocked, 2);
  });

  it("formatted output contains task titles and scores", async () => {
    const store = new MockPlanStore([{
      id: "master-plan", title: "Master Plan", status: "active",
      tasks: [{ id: "t1", title: "Write cutover plan", status: "pending", owner: "pm" }],
    }]);
    const result = await generateFocusBrief({ planStore: store, minScore: 0 });
    assert.ok(result.formatted.includes("Write cutover plan"));
    assert.ok(result.formatted.includes("Master Plan"));
    assert.ok(/Focus Brief/.test(result.formatted));
  });
});

// ─── _formatBrief ───

describe("_formatBrief", () => {
  it("produces 'No actionable' when empty", () => {
    const out = _formatBrief([]);
    assert.ok(out.includes("No actionable tasks"));
  });

  it("numbers tasks from 1", () => {
    const tasks = [
      new TaskScore({ taskId: "a", planId: "p", score: 50, urgency: "urgent", reasons: ["needs your input"] }),
      new TaskScore({ taskId: "b", planId: "p", score: 40, urgency: "normal" }),
    ];
    const out = _formatBrief(tasks);
    assert.ok(out.includes("1. [URGENT]"));
    assert.ok(out.includes("2. [NORMAL]"));
  });

  it("includes totalPending footer when stats given", () => {
    const tasks = [new TaskScore({ taskId: "a", planId: "p", score: 50 })];
    const out = _formatBrief(tasks, { totalPending: 12, pmBlocked: 4 });
    assert.ok(out.includes("12 tasks pending"));
    assert.ok(out.includes("4 waiting on you"));
  });
});
