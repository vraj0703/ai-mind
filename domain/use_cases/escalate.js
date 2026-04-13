/**
 * Escalate — when mind can't handle something, route it upward.
 *
 * Two escalation targets:
 * - Mr. V (terminal inbox) — for tasks that need Claude's reasoning
 * - PM (WhatsApp/SMS) — for system-level alerts that need human intervention
 *
 * Pure logic. The caller uses IAlertChannel to actually send.
 */

const { Decision } = require("../entities/decision");
const { MR_V_OFFLINE_THRESHOLD_MS, MAX_AUTO_RESPONSES_PER_TICK } = require("../constants");

/**
 * Build an escalation Decision for Mr. V's terminal inbox.
 *
 * @param {import('../entities/input').Input} input
 * @param {string} reason
 * @param {string} [priority="normal"]
 * @returns {Decision}
 */
function escalateToMrV(input, reason, priority = "normal") {
  return new Decision({
    type: "escalation",
    target: "mr-v",
    payload: {
      originalInput: {
        id: input.id,
        source: input.source,
        sender: input.sender,
        text: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload),
      },
      reason,
      priority,
    },
    reasoning: `Escalating to Mr. V: ${reason}`,
    confidence: 0.5,
    inputId: input.id,
  });
}

/**
 * Build an escalation Decision for PM (critical alerts).
 *
 * @param {string} subject
 * @param {object} details
 * @param {string} [channel="whatsapp"] - "whatsapp" | "sms" | "dashboard"
 * @returns {Decision}
 */
function escalateToPM(subject, details, channel = "whatsapp") {
  return new Decision({
    type: "escalation",
    target: "pm",
    payload: {
      subject,
      details,
      channel,
      timestamp: new Date().toISOString(),
    },
    reasoning: `PM alert: ${subject}`,
    confidence: 0.95,
  });
}

/**
 * Decide whether Mr. V has been offline long enough to auto-respond.
 *
 * @param {string|null} lastMrVActivity - ISO timestamp of last Mr. V interaction
 * @param {number} [thresholdMs]
 * @returns {boolean}
 */
function isMrVOffline(lastMrVActivity, thresholdMs = MR_V_OFFLINE_THRESHOLD_MS) {
  if (!lastMrVActivity) return true;
  const elapsed = Date.now() - new Date(lastMrVActivity).getTime();
  return elapsed > thresholdMs;
}

/**
 * Decide which pending inbox items should get auto-responses.
 * Rate-limited to MAX_AUTO_RESPONSES_PER_TICK.
 *
 * @param {object[]} inboxItems - pending items from terminal inbox
 * @param {string|null} lastMrVActivity
 * @param {number} [maxPerTick]
 * @returns {object[]} - items to auto-respond (subset of inboxItems)
 */
function selectAutoResponses(inboxItems, lastMrVActivity, maxPerTick = MAX_AUTO_RESPONSES_PER_TICK) {
  if (!isMrVOffline(lastMrVActivity)) return [];
  const pending = inboxItems.filter(item => item.status === "pending");
  return pending.slice(0, maxPerTick);
}

module.exports = { escalateToMrV, escalateToPM, isMrVOffline, selectAutoResponses };
