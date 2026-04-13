/**
 * IServiceMonitor — abstract interface for checking + restarting services.
 *
 * Mind's supervisor calls this to watch over the mesh.
 * The data layer decides whether it's HTTP health checks, process pings, etc.
 *
 * Implementations: data/repositories/http_service_monitor.js
 */

class IServiceMonitor {
  /**
   * Check health of a single service.
   * @param {import('../entities/service').Service} service
   * @returns {Promise<{status: string, error?: string, responseMs?: number}>}
   */
  async checkHealth(service) {
    throw new Error("IServiceMonitor.checkHealth() not implemented");
  }

  /**
   * Attempt to restart a service.
   * @param {import('../entities/service').Service} service
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async restart(service) {
    throw new Error("IServiceMonitor.restart() not implemented");
  }

  /**
   * Check health of all monitored services.
   * @param {import('../entities/service').Service[]} services
   * @returns {Promise<import('../entities/service').Service[]>} - updated services with new status
   */
  async checkAll(services) {
    throw new Error("IServiceMonitor.checkAll() not implemented");
  }
}

module.exports = { IServiceMonitor };
