/**
 * Decision — the output of mind's reasoning.
 *
 * Every action mind takes is expressed as a Decision first.
 * Decisions are logged, auditable, and replayable.
 */

const VALID_TYPES = ["response", "action", "escalation", "observation"];
const VALID_TARGETS = [
  "whatsapp", "dashboard", "cli", "cron",
  "mr-v", "pm",
  // service:<name> pattern handled separately
];

class Decision {
  /**
   * @param {object} raw
   * @param {string} raw.type        - "response" | "action" | "escalation" | "observation"
   * @param {string} raw.target      - where this decision is directed
   * @param {*}      raw.payload     - the content (response text, action command, escalation data)
   * @param {string} [raw.reasoning] - why this decision was made (for audit trail)
   * @param {number} [raw.confidence=1.0] - 0.0 to 1.0
   * @param {string} [raw.inputId]   - ID of the Input that triggered this decision
   * @param {string} [raw.model]     - LLM model used, if any
   * @param {object} [raw.tokens]    - { in, out } token counts
   * @param {string} [raw.timestamp]
   * @param {string} [raw.id]
   */
  constructor(raw) {
    if (!raw || typeof raw !== "object") {
      throw new DecisionValidationError("Decision must be an object");
    }
    if (!VALID_TYPES.includes(raw.type)) {
      throw new DecisionValidationError(`Invalid type "${raw.type}". Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (!raw.target || typeof raw.target !== "string") {
      throw new DecisionValidationError("target is required and must be a string");
    }
    if (!this._isValidTarget(raw.target)) {
      throw new DecisionValidationError(`Invalid target "${raw.target}". Must be a known target or "service:<name>".`);
    }
    if (raw.payload === undefined || raw.payload === null) {
      throw new DecisionValidationError("payload is required");
    }

    this.type = raw.type;
    this.target = raw.target;
    this.payload = raw.payload;
    this.reasoning = raw.reasoning || "";
    this.confidence = typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 1.0;
    this.inputId = raw.inputId || null;
    this.model = raw.model || null;
    this.tokens = raw.tokens || null;
    this.timestamp = raw.timestamp || new Date().toISOString();
    this.id = raw.id || `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _isValidTarget(target) {
    if (VALID_TARGETS.includes(target)) return true;
    if (target.startsWith("service:")) return true;
    return false;
  }

  isEscalation() {
    return this.type === "escalation";
  }

  isHighConfidence(threshold = 0.8) {
    return this.confidence >= threshold;
  }

  toLogEntry() {
    return {
      id: this.id,
      type: this.type,
      target: this.target,
      reasoning: this.reasoning,
      confidence: this.confidence,
      inputId: this.inputId,
      model: this.model,
      tokens: this.tokens,
      timestamp: this.timestamp,
    };
  }
}

class DecisionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DecisionValidationError";
  }
}

module.exports = { Decision, DecisionValidationError, VALID_TYPES, VALID_TARGETS };
