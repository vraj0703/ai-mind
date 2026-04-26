/**
 * NoopServiceMonitor — default in-tree mock for IServiceMonitor.
 *
 * Reports every service as healthy without making network calls. Restart is a
 * no-op that succeeds. Combined with an empty SERVICES array, the supervisor
 * loop becomes a quiet heartbeat with nothing to do.
 */

const { IServiceMonitor } = require("../../../domain/repositories/i_service_monitor");

class NoopServiceMonitor extends IServiceMonitor {
  async checkHealth(service) {
    return { status: "healthy", responseMs: 0 };
  }

  async restart(service) {
    return { success: true };
  }

  async checkAll(services) {
    return (services || []).map(s => {
      // Mutate-style update matching HTTPServiceMonitor's contract: return
      // the same Service objects with updated status. Keeps callers happy.
      if (typeof s === "object" && s) s.status = "healthy";
      return s;
    });
  }
}

module.exports = { NoopServiceMonitor };
