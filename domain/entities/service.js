/**
 * Service — a monitored service in the mesh.
 *
 * Mind's supervisor watches services and decides whether to restart,
 * escalate, or wait. This entity captures a service's identity and
 * its current observed health.
 */

const VALID_STATUSES = ["healthy", "degraded", "restarting", "dead", "unknown"];

class Service {
  /**
   * @param {object} raw
   * @param {string} raw.name        - e.g. "whatsapp", "cortex", "knowledge"
   * @param {number} raw.port
   * @param {string} raw.healthUrl   - full URL for health check
   * @param {string} [raw.status="unknown"]
   * @param {boolean} [raw.restartEnabled=true]
   * @param {number}  [raw.restarts=0]       - restart count this session
   * @param {string}  [raw.lastChecked]      - ISO timestamp of last health check
   * @param {string}  [raw.lastError]        - last error message, if any
   */
  constructor(raw) {
    if (!raw.name || typeof raw.name !== "string") {
      throw new Error("Service name is required");
    }
    if (typeof raw.port !== "number" || raw.port < 1) {
      throw new Error("Service port must be a positive number");
    }

    this.name = raw.name;
    this.port = raw.port;
    this.healthUrl = raw.healthUrl || `http://127.0.0.1:${raw.port}/health`;
    this.status = VALID_STATUSES.includes(raw.status) ? raw.status : "unknown";
    this.restartEnabled = raw.restartEnabled !== false;
    this.restarts = raw.restarts || 0;
    this.lastChecked = raw.lastChecked || null;
    this.lastError = raw.lastError || null;
  }

  isHealthy() {
    return this.status === "healthy";
  }

  isDead() {
    return this.status === "dead";
  }

  needsAttention() {
    return this.status === "degraded" || this.status === "dead";
  }

  canRestart() {
    return this.restartEnabled && this.restarts < 3;
  }

  withHealth(status, error = null) {
    return new Service({
      ...this,
      status,
      lastChecked: new Date().toISOString(),
      lastError: error,
      restarts: status === "restarting" ? this.restarts + 1 : this.restarts,
    });
  }
}

module.exports = { Service, VALID_STATUSES };
