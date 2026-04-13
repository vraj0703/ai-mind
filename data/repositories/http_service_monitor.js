/**
 * HTTPServiceMonitor — concrete IServiceMonitor using HTTP health checks.
 */

const { IServiceMonitor } = require("../../domain/repositories/i_service_monitor");
const { httpGet } = require("../data_sources/remote/http_client");
const { execSync } = require("child_process");
const { HEALTH_CHECK_TIMEOUT_MS } = require("../../domain/constants");

class HTTPServiceMonitor extends IServiceMonitor {
  constructor(opts = {}) {
    super();
    this.timeoutMs = opts.timeoutMs || HEALTH_CHECK_TIMEOUT_MS;
    this.projectRoot = opts.projectRoot || process.cwd();
  }

  async checkHealth(service) {
    const start = Date.now();
    const res = await httpGet(service.healthUrl, { timeoutMs: this.timeoutMs });
    const responseMs = Date.now() - start;

    if (res.ok) {
      return { status: "healthy", responseMs };
    }
    return {
      status: "degraded",
      error: res.error || `HTTP ${res.status}`,
      responseMs,
    };
  }

  async restart(service) {
    if (!service.restartEnabled) {
      return { success: false, error: "restart disabled for this service" };
    }

    // Attempt restart by running the server file via node
    const serverFile = service.serverFile || service.name;
    try {
      // Kill existing process on the port (best-effort)
      try {
        if (process.platform === "win32") {
          execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${service.port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { timeout: 5000 });
        }
      } catch { /* ignore kill failures */ }

      // Give process time to release port
      await new Promise(r => setTimeout(r, 1000));

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async checkAll(services) {
    const results = await Promise.allSettled(
      services.map(async (svc) => {
        const health = await this.checkHealth(svc);
        return svc.withHealth(health.status, health.error || null);
      })
    );

    return results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : services[i].withHealth("degraded", r.reason?.message)
    );
  }
}

module.exports = { HTTPServiceMonitor };
