/**
 * Tests for the Ollama + cron gateway use cases.
 *
 * Uses mock ILLMClient / IJobScheduler — no network, no real services.
 */

const { test } = require("node:test");
const assert = require("node:assert");

const { queryLLM } = require("./query_llm");
const {
  listJobs,
  triggerJob,
  pauseJob,
  resumeJob,
  getJobHistory,
} = require("./manage_jobs");

// ─── queryLLM ──────────────────────────────────────────────────────────

function makeMockLLM() {
  const calls = [];
  return {
    calls,
    async generate(params) {
      calls.push(params);
      return { text: `echo:${params.prompt}`, tokens: 7, elapsedMs: 42 };
    },
    async listModels() { return []; },
    async isAvailable() { return true; },
  };
}

test("queryLLM passes params through to llmClient.generate", async () => {
  const llm = makeMockLLM();
  const out = await queryLLM({
    prompt: "hello",
    model: "gemma4:e4b",
    system: "be brief",
    temperature: 0.5,
    llmClient: llm,
  });
  assert.strictEqual(out.text, "echo:hello");
  assert.strictEqual(out.tokens, 7);
  assert.strictEqual(out.elapsedMs, 42);
  assert.strictEqual(llm.calls.length, 1);
  assert.strictEqual(llm.calls[0].model, "gemma4:e4b");
  assert.strictEqual(llm.calls[0].system, "be brief");
  assert.strictEqual(llm.calls[0].temperature, 0.5);
});

test("queryLLM defaults temperature to 0.3", async () => {
  const llm = makeMockLLM();
  await queryLLM({ prompt: "x", llmClient: llm });
  assert.strictEqual(llm.calls[0].temperature, 0.3);
});

test("queryLLM throws without llmClient", async () => {
  await assert.rejects(() => queryLLM({ prompt: "x" }), /llmClient is required/);
});

// ─── manage_jobs ───────────────────────────────────────────────────────

function makeMockScheduler() {
  const calls = [];
  return {
    calls,
    async health() { calls.push(["health"]); return { active: 1, paused: 0, total: 1 }; },
    async listJobs() { calls.push(["listJobs"]); return [{ key: "heartbeat" }]; },
    async triggerJob(key) { calls.push(["triggerJob", key]); return { ok: true, result: { success: true } }; },
    async pauseJob(key) { calls.push(["pauseJob", key]); return true; },
    async resumeJob(key) { calls.push(["resumeJob", key]); return true; },
    async jobHistory() { calls.push(["jobHistory"]); return [{ key: "heartbeat", success: true }]; },
  };
}

test("listJobs delegates to scheduler", async () => {
  const s = makeMockScheduler();
  const out = await listJobs({ jobScheduler: s });
  assert.deepStrictEqual(out, [{ key: "heartbeat" }]);
  assert.deepStrictEqual(s.calls, [["listJobs"]]);
});

test("triggerJob passes key through", async () => {
  const s = makeMockScheduler();
  const out = await triggerJob({ jobScheduler: s, key: "heartbeat" });
  assert.strictEqual(out.ok, true);
  assert.deepStrictEqual(s.calls, [["triggerJob", "heartbeat"]]);
});

test("triggerJob returns error without key", async () => {
  const s = makeMockScheduler();
  const out = await triggerJob({ jobScheduler: s });
  assert.strictEqual(out.ok, false);
  assert.match(out.error, /key is required/);
  assert.strictEqual(s.calls.length, 0);
});

test("pauseJob / resumeJob return booleans", async () => {
  const s = makeMockScheduler();
  assert.strictEqual(await pauseJob({ jobScheduler: s, key: "x" }), true);
  assert.strictEqual(await resumeJob({ jobScheduler: s, key: "x" }), true);
  assert.strictEqual(await pauseJob({ jobScheduler: s }), false);
  assert.strictEqual(await resumeJob({ jobScheduler: s }), false);
});

test("getJobHistory delegates to scheduler", async () => {
  const s = makeMockScheduler();
  const out = await getJobHistory({ jobScheduler: s });
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].key, "heartbeat");
});

test("use cases throw without scheduler injected", async () => {
  await assert.rejects(() => listJobs({}), /jobScheduler is required/);
  await assert.rejects(() => triggerJob({ key: "x" }), /jobScheduler is required/);
  await assert.rejects(() => pauseJob({ key: "x" }), /jobScheduler is required/);
  await assert.rejects(() => resumeJob({ key: "x" }), /jobScheduler is required/);
  await assert.rejects(() => getJobHistory({}), /jobScheduler is required/);
});
