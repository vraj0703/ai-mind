/**
 * RouterController — handles incoming messages.
 *
 * Receives an Input, routes it (T1/T2/T3), processes it,
 * and returns a Decision.
 */

const { Input } = require("../../../domain/entities/input");
const { Decision } = require("../../../domain/entities/decision");
const { routeInput } = require("../../../domain/use_cases/route_input");
const { processT2Message, assessComplexity } = require("../../../domain/use_cases/process_message");
const { escalateToMrV } = require("../../../domain/use_cases/escalate");
const { executeDecision } = require("../../../domain/use_cases/execute_decision");

class RouterController {
  constructor(deps) {
    this.llm = deps.llm;
    this.contextProvider = deps.contextProvider;
    this.stateWriter = deps.stateWriter;
    this.alertChannel = deps.alertChannel;
    this.serviceMonitor = deps.serviceMonitor;
    this.planStore = deps.planStore;

    this._terminalInbox = [];
    this._recentMessages = [];
    this._sseClients = new Set();
  }

  /**
   * Main entry point: process a raw request into a response.
   *
   * @param {object} raw - { type, source, sender, payload, priority }
   * @returns {Promise<{decision: Decision, route: object}>}
   */
  async handleMessage(raw) {
    const input = new Input({
      type: raw.type || "message",
      source: raw.source || "cli",
      sender: raw.sender || "unknown",
      payload: raw.payload || raw.message || "",
      priority: raw.priority || "normal",
    });

    const route = routeInput(input);
    let decision;

    switch (route.tier) {
      case "T1":
        decision = await this._handleT1(input, route);
        break;
      case "T2":
        decision = await this._handleT2(input, route);
        break;
      case "T3":
        decision = this._handleT3(input, route);
        break;
      default:
        decision = new Decision({
          type: "response",
          target: input.source,
          payload: "Unknown routing tier",
          reasoning: "fallback",
          inputId: input.id,
        });
    }

    // Record
    this._recentMessages.unshift({ input: input.id, decision: decision.id, timestamp: decision.timestamp });
    if (this._recentMessages.length > 100) this._recentMessages.length = 100;

    // Broadcast to SSE clients
    this._broadcast({ type: "message", input: { id: input.id, source: input.source, sender: input.sender }, decision: decision.toLogEntry() });

    return { decision, route };
  }

  async _handleT1(input, route) {
    const text = typeof input.payload === "string" ? input.payload : "";

    switch (route.handler) {
      case "service_health": {
        const ctx = await this.contextProvider.getContext();
        const lines = ctx.services.map(s => `${s.name} :${s.port} — ${s.status}`);
        return new Decision({ type: "response", target: input.source, payload: lines.join("\n") || "no services configured", reasoning: "T1 /status", inputId: input.id });
      }
      case "plan_summary": {
        const ctx = await this.contextProvider.getContext();
        const lines = ctx.getActivePlans().map(p => { const prog = p.progress(); return `${p.id}: ${prog.done}/${prog.total} (${prog.pct}%)`; });
        return new Decision({ type: "response", target: input.source, payload: lines.join("\n") || "no active plans", reasoning: "T1 /plan", inputId: input.id });
      }
      case "help":
        return new Decision({ type: "response", target: input.source, payload: "Commands: /status /plan /know <q> /cron /help /mrv <msg> /urgent <msg> @planning @review @resources @design @cortex", reasoning: "T1 /help", inputId: input.id });
      case "focus_command":
        return new Decision({ type: "response", target: input.source, payload: `Focus command received: ${route.params.command}`, reasoning: "T1 focus", inputId: input.id });
      case "cortex_command":
        return new Decision({ type: "response", target: input.source, payload: `Cortex command: ${route.params.command}`, reasoning: "T1 @cortex", inputId: input.id });
      case "knowledge_search":
        return new Decision({ type: "response", target: input.source, payload: `Knowledge search: ${route.params.args}`, reasoning: "T1 /know", inputId: input.id });
      default:
        return new Decision({ type: "response", target: input.source, payload: `Handled: ${route.handler}`, reasoning: `T1 ${route.handler}`, inputId: input.id });
    }
  }

  async _handleT2(input, route) {
    try {
      const context = await this.contextProvider.getContext();

      if (route.handler === "smart_triage") {
        const { complexity, delegation } = assessComplexity(input, context);
        if (delegation.modelTier === "T3") {
          return this._handleT3(input, { ...route, tier: "T3", handler: "escalate_complexity" });
        }
      }

      return await processT2Message({ input, context, route, llm: this.llm });
    } catch (err) {
      if (err.name === "LLMUnavailableError") {
        return escalateToMrV(input, "LLM unavailable — falling back to Mr. V");
      }
      return new Decision({ type: "response", target: input.source, payload: `Error: ${err.message}`, reasoning: "T2 error", inputId: input.id });
    }
  }

  _handleT3(input, route) {
    const escalation = escalateToMrV(input, `${route.handler}: ${route.params?.text || "escalated"}`);
    this._terminalInbox.push({
      id: escalation.id,
      inputId: input.id,
      source: input.source,
      sender: input.sender,
      text: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload),
      status: "pending",
      queuedAt: new Date().toISOString(),
    });
    return escalation;
  }

  getInbox(status = "pending") {
    return this._terminalInbox.filter(i => !status || i.status === status);
  }

  respondToInboxItem(id, response) {
    const item = this._terminalInbox.find(i => i.id === id);
    if (!item) return null;
    item.status = "responded";
    item.response = response;
    item.respondedAt = new Date().toISOString();
    return item;
  }

  addSSEClient(client) {
    this._sseClients.add(client);
  }

  removeSSEClient(client) {
    this._sseClients.delete(client);
  }

  _broadcast(data) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this._sseClients) {
      try { client.write(msg); } catch { this._sseClients.delete(client); }
    }
  }
}

module.exports = { RouterController };
