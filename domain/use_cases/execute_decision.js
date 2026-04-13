/**
 * ExecuteDecision — dispatch a Decision to the appropriate handler.
 *
 * This is the LAST step in mind's pipeline. A Decision has been made;
 * now we make it happen. The executor calls repository interfaces
 * (IAlertChannel, IServiceMonitor, IStateWriter) — it never touches
 * HTTP or filesystem directly.
 *
 * Dependencies: repositories (injected), entities
 */

const { Decision } = require("../entities/decision");

/**
 * @typedef {object} ExecutionDeps
 * @property {import('../repositories/i_alert_channel').IAlertChannel} alertChannel
 * @property {import('../repositories/i_service_monitor').IServiceMonitor} serviceMonitor
 * @property {import('../repositories/i_state_writer').IStateWriter} stateWriter
 * @property {import('../repositories/i_plan_store').IPlanStore} planStore
 */

/**
 * Execute a single decision.
 *
 * @param {Decision} decision
 * @param {ExecutionDeps} deps - injected repositories
 * @returns {Promise<{success: boolean, action: string, detail?: any, error?: string}>}
 */
async function executeDecision(decision, deps) {
  // Always log the decision
  try {
    await deps.stateWriter.logDecision(decision);
  } catch (logErr) {
    // Don't block execution if logging fails
  }

  switch (decision.type) {
    case "response":
      return executeResponse(decision, deps);
    case "action":
      return executeAction(decision, deps);
    case "escalation":
      return executeEscalation(decision, deps);
    case "observation":
      // Observations are logged-only, no side effect
      return { success: true, action: "logged_observation" };
    default:
      return { success: false, action: "unknown_type", error: `Unknown decision type: ${decision.type}` };
  }
}

async function executeResponse(decision, deps) {
  // Response decisions are sent back via the alert channel to the original source
  try {
    const result = await deps.alertChannel.send(
      decision.target,
      typeof decision.payload === "string" ? decision.payload : JSON.stringify(decision.payload),
      "normal"
    );
    return { success: result.sent, action: "response_sent", detail: { channel: result.channel } };
  } catch (err) {
    return { success: false, action: "response_failed", error: err.message };
  }
}

async function executeAction(decision, deps) {
  const payload = decision.payload || {};
  const action = payload.action;

  if (action === "restart" && decision.target.startsWith("service:")) {
    const serviceName = decision.target.slice("service:".length);
    try {
      const result = await deps.serviceMonitor.restart({ name: serviceName });
      return { success: result.success, action: "service_restart", detail: { service: serviceName } };
    } catch (err) {
      return { success: false, action: "restart_failed", error: err.message };
    }
  }

  if (action === "update_task" && payload.planId && payload.taskId) {
    try {
      const updated = await deps.planStore.updateTaskStatus(
        payload.planId,
        payload.taskId,
        payload.newStatus || "done"
      );
      return { success: updated, action: "task_updated", detail: payload };
    } catch (err) {
      return { success: false, action: "task_update_failed", error: err.message };
    }
  }

  return { success: true, action: "action_logged", detail: payload };
}

async function executeEscalation(decision, deps) {
  const target = decision.target; // "pm" or "mr-v"
  const subject = decision.payload?.subject || decision.reasoning || "Escalation";
  const message = typeof decision.payload === "string"
    ? decision.payload
    : `[${decision.type.toUpperCase()}] ${subject}\n${JSON.stringify(decision.payload, null, 2)}`;

  try {
    const result = await deps.alertChannel.send(target, message, "urgent");
    return { success: result.sent, action: "escalation_sent", detail: { target, channel: result.channel } };
  } catch (err) {
    return { success: false, action: "escalation_failed", error: err.message };
  }
}

module.exports = { executeDecision };
