/**
 * Input — a signal arriving at mind from the outside world.
 *
 * Inputs come from senses (WhatsApp, dashboard, CLI, cron, mobile).
 * Mind doesn't know HOW the input arrived — only WHAT it is.
 */

const VALID_TYPES = ["message", "event", "alert", "health"];
const VALID_SOURCES = ["whatsapp", "dashboard", "cli", "cron", "mobile", "cortex-internal"];
const VALID_PRIORITIES = ["background", "normal", "urgent"];

class Input {
  /**
   * @param {object} raw
   * @param {string} raw.type      - "message" | "event" | "alert" | "health"
   * @param {string} raw.source    - where this input originated
   * @param {string} raw.sender    - who sent it (phone number, username, service name)
   * @param {*}      raw.payload   - the content (message text, event data, health snapshot)
   * @param {string} [raw.priority="normal"]
   * @param {string} [raw.timestamp]  - ISO string, defaults to now
   * @param {string} [raw.id]         - unique ID, auto-generated if absent
   */
  constructor(raw) {
    if (!raw || typeof raw !== "object") {
      throw new InputValidationError("Input must be an object");
    }
    if (!VALID_TYPES.includes(raw.type)) {
      throw new InputValidationError(`Invalid type "${raw.type}". Must be one of: ${VALID_TYPES.join(", ")}`);
    }
    if (!VALID_SOURCES.includes(raw.source)) {
      throw new InputValidationError(`Invalid source "${raw.source}". Must be one of: ${VALID_SOURCES.join(", ")}`);
    }
    if (!raw.sender || typeof raw.sender !== "string") {
      throw new InputValidationError("sender is required and must be a string");
    }
    if (raw.payload === undefined || raw.payload === null) {
      throw new InputValidationError("payload is required");
    }

    this.type = raw.type;
    this.source = raw.source;
    this.sender = raw.sender;
    this.payload = raw.payload;
    this.priority = VALID_PRIORITIES.includes(raw.priority) ? raw.priority : "normal";
    this.timestamp = raw.timestamp || new Date().toISOString();
    this.id = raw.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  isUrgent() {
    return this.priority === "urgent";
  }

  isMessage() {
    return this.type === "message";
  }

  isHealth() {
    return this.type === "health";
  }
}

class InputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputValidationError";
  }
}

module.exports = { Input, InputValidationError, VALID_TYPES, VALID_SOURCES, VALID_PRIORITIES };
