const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildWaves, findNextTasks } = require("./evaluate_plans");
const { Task, Plan } = require("../entities/plan");

function task(id, opts = {}) {
  return new Task({ id, title: `Task ${id}`, ...opts });
}

describe("evaluate_plans", () => {

  describe("buildWaves", () => {
    it("puts all independent tasks in wave 0", () => {
      const tasks = [task("A"), task("B"), task("C")];
      const waves = buildWaves(tasks);
      assert.strictEqual(waves.length, 1);
      assert.strictEqual(waves[0].length, 3);
    });

    it("separates dependent tasks into later waves", () => {
      const tasks = [
        task("A"),
        task("B", { depends: ["A"] }),
        task("C", { depends: ["B"] }),
      ];
      const waves = buildWaves(tasks);
      assert.strictEqual(waves.length, 3);
      assert.strictEqual(waves[0][0].id, "A");
      assert.strictEqual(waves[1][0].id, "B");
      assert.strictEqual(waves[2][0].id, "C");
    });

    it("groups parallel-safe tasks in same wave", () => {
      const tasks = [
        task("A"),
        task("B"),
        task("C", { depends: ["A", "B"] }),
      ];
      const waves = buildWaves(tasks);
      assert.strictEqual(waves.length, 2);
      assert.strictEqual(waves[0].length, 2); // A and B
      assert.strictEqual(waves[1].length, 1); // C
    });

    it("skips done tasks and treats their deps as resolved", () => {
      const tasks = [
        task("A", { status: "done" }),
        task("B", { depends: ["A"] }),
      ];
      const waves = buildWaves(tasks);
      assert.strictEqual(waves.length, 1);
      assert.strictEqual(waves[0][0].id, "B");
    });

    it("skips blocked/deferred tasks", () => {
      const tasks = [
        task("A", { status: "blocked" }),
        task("B"),
      ];
      const waves = buildWaves(tasks);
      assert.strictEqual(waves.length, 1);
      assert.strictEqual(waves[0][0].id, "B");
    });

    it("throws PlanCycleDetected on circular deps", () => {
      const tasks = [
        task("A", { depends: ["B"] }),
        task("B", { depends: ["A"] }),
      ];
      assert.throws(() => buildWaves(tasks), { name: "PlanCycleDetected" });
    });

    it("returns empty waves for all-done plan", () => {
      const tasks = [
        task("A", { status: "done" }),
        task("B", { status: "done" }),
      ];
      const waves = buildWaves(tasks);
      assert.strictEqual(waves.length, 0);
    });

    it("returns empty waves for empty input", () => {
      assert.strictEqual(buildWaves([]).length, 0);
    });
  });

  describe("findNextTasks", () => {
    it("returns wave-0 tasks from active plans", () => {
      const plans = [
        new Plan({
          id: "p1", title: "Plan 1",
          tasks: [
            { id: "T1", title: "Do A", score: 50 },
            { id: "T2", title: "Do B", depends: ["T1"], score: 40 },
          ],
        }),
      ];
      const next = findNextTasks(plans, { minScore: 0 });
      assert.strictEqual(next.length, 1);
      assert.strictEqual(next[0].task.id, "T1");
      assert.strictEqual(next[0].planId, "p1");
    });

    it("filters by minScore", () => {
      const plans = [
        new Plan({
          id: "p1", title: "Plan 1",
          tasks: [
            { id: "T1", title: "Low score", score: 10 },
            { id: "T2", title: "High score", score: 80 },
          ],
        }),
      ];
      const next = findNextTasks(plans, { minScore: 30 });
      assert.strictEqual(next.length, 1);
      assert.strictEqual(next[0].task.id, "T2");
    });

    it("sorts by score descending", () => {
      const plans = [
        new Plan({
          id: "p1", title: "Plan 1",
          tasks: [
            { id: "A", title: "A", score: 30 },
            { id: "B", title: "B", score: 90 },
            { id: "C", title: "C", score: 60 },
          ],
        }),
      ];
      const next = findNextTasks(plans, { minScore: 0 });
      assert.strictEqual(next[0].task.id, "B");
      assert.strictEqual(next[1].task.id, "C");
      assert.strictEqual(next[2].task.id, "A");
    });

    it("respects maxTasks limit", () => {
      const plans = [
        new Plan({
          id: "p1", title: "Plan 1",
          tasks: [
            { id: "A", title: "A", score: 50 },
            { id: "B", title: "B", score: 50 },
            { id: "C", title: "C", score: 50 },
          ],
        }),
      ];
      const next = findNextTasks(plans, { minScore: 0, maxTasks: 2 });
      assert.strictEqual(next.length, 2);
    });

    it("skips inactive plans", () => {
      const plans = [
        new Plan({ id: "p1", title: "Inactive", status: "archived", tasks: [{ id: "T1", title: "X", score: 99 }] }),
      ];
      const next = findNextTasks(plans, { minScore: 0 });
      assert.strictEqual(next.length, 0);
    });

    it("skips cyclic plans without crashing", () => {
      const plans = [
        new Plan({
          id: "cyclic", title: "Cyclic",
          tasks: [
            { id: "A", title: "A", depends: ["B"], score: 50 },
            { id: "B", title: "B", depends: ["A"], score: 50 },
          ],
        }),
        new Plan({
          id: "good", title: "Good",
          tasks: [{ id: "T1", title: "OK", score: 50 }],
        }),
      ];
      const next = findNextTasks(plans, { minScore: 0 });
      assert.strictEqual(next.length, 1);
      assert.strictEqual(next[0].planId, "good");
    });
  });
});
