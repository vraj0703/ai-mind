/**
 * Domain exceptions — typed errors for mind's business rules.
 *
 * These are thrown by use cases when something goes wrong in the DOMAIN,
 * not in infrastructure. Infrastructure failures (network, filesystem)
 * should be caught by the data layer and wrapped if needed.
 */

class MindError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "MindError";
    this.code = code;
  }
}

class ServiceDownError extends MindError {
  constructor(serviceName, detail) {
    super(`Service "${serviceName}" is down: ${detail || "no response"}`, "SERVICE_DOWN");
    this.name = "ServiceDownError";
    this.serviceName = serviceName;
  }
}

class LLMTimeoutError extends MindError {
  constructor(model, timeoutMs) {
    super(`LLM "${model}" timed out after ${timeoutMs}ms`, "LLM_TIMEOUT");
    this.name = "LLMTimeoutError";
    this.model = model;
    this.timeoutMs = timeoutMs;
  }
}

class LLMUnavailableError extends MindError {
  constructor(provider, detail) {
    super(`LLM provider "${provider}" unavailable: ${detail || "unreachable"}`, "LLM_UNAVAILABLE");
    this.name = "LLMUnavailableError";
    this.provider = provider;
  }
}

class EscalationRequired extends MindError {
  constructor(reason, inputId) {
    super(`Escalation required: ${reason}`, "ESCALATION_REQUIRED");
    this.name = "EscalationRequired";
    this.reason = reason;
    this.inputId = inputId;
  }
}

class InvalidInputError extends MindError {
  constructor(detail) {
    super(`Invalid input: ${detail}`, "INVALID_INPUT");
    this.name = "InvalidInputError";
  }
}

class PlanCycleDetected extends MindError {
  constructor(planId, taskIds) {
    super(`Dependency cycle detected in plan "${planId}": ${taskIds.join(" → ")}`, "PLAN_CYCLE");
    this.name = "PlanCycleDetected";
    this.planId = planId;
    this.taskIds = taskIds;
  }
}

module.exports = {
  MindError,
  ServiceDownError,
  LLMTimeoutError,
  LLMUnavailableError,
  EscalationRequired,
  InvalidInputError,
  PlanCycleDetected,
};
