/**
 * ContextAssembler — concrete IContextProvider that gathers context from multiple sources.
 */

const { IContextProvider } = require("../../domain/repositories/i_context_provider");
const { Context } = require("../../domain/entities/context");

class ContextAssembler extends IContextProvider {
  /**
   * @param {object} deps
   * @param {import('../../domain/repositories/i_plan_store').IPlanStore} deps.planStore
   * @param {import('./http_service_monitor').HTTPServiceMonitor} deps.serviceMonitor
   * @param {import('../../domain/entities/service').Service[]} deps.serviceList - configured services
   */
  constructor(deps = {}) {
    super();
    this.planStore = deps.planStore;
    this.serviceMonitor = deps.serviceMonitor;
    this.serviceList = deps.serviceList || [];
  }

  async getContext() {
    const [plans, services] = await Promise.allSettled([
      this.planStore ? this.planStore.loadAll() : [],
      this.getServiceHealth(),
    ]);

    return new Context({
      plans: plans.status === "fulfilled" ? plans.value : [],
      services: services.status === "fulfilled" ? services.value : this.serviceList,
      capabilities: [],
      cognitive: {},
      history: [],
      session: {},
      resources: {},
    });
  }

  async getServiceHealth() {
    if (!this.serviceMonitor || this.serviceList.length === 0) {
      return this.serviceList;
    }
    return this.serviceMonitor.checkAll(this.serviceList);
  }
}

module.exports = { ContextAssembler };
