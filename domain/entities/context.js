/**
 * Context — everything mind needs from memory to make decisions.
 *
 * Context is assembled by the data layer from multiple sources
 * (plans, capabilities, cognitive state, session state) and passed
 * to use cases as a single read-only bundle.
 */

class Context {
  /**
   * @param {object} raw
   * @param {import('./plan').Plan[]}    [raw.plans]        - active operational plans
   * @param {object[]}                   [raw.capabilities] - knowledge service capabilities
   * @param {object}                     [raw.cognitive]    - { reflection, attention, calibration }
   * @param {import('./decision').Decision[]} [raw.history] - recent decisions
   * @param {import('./service').Service[]}   [raw.services] - current service health
   * @param {object}                     [raw.session]      - session metadata (uptime, boot mode, etc.)
   * @param {object}                     [raw.resources]    - { cpu, ram, vram }
   */
  constructor(raw = {}) {
    this.plans = raw.plans || [];
    this.capabilities = raw.capabilities || [];
    this.cognitive = raw.cognitive || {};
    this.history = raw.history || [];
    this.services = raw.services || [];
    this.session = raw.session || {};
    this.resources = raw.resources || {};
  }

  getHealthyServices() {
    return this.services.filter(s => s.isHealthy ? s.isHealthy() : s.status === "healthy");
  }

  getDownServices() {
    return this.services.filter(s => s.isDead ? s.isDead() : s.status === "dead");
  }

  getActivePlans() {
    return this.plans.filter(p => p.status === "active");
  }

  getRecentDecisions(n = 5) {
    return this.history.slice(0, n);
  }

  isEmpty() {
    return this.plans.length === 0
      && this.capabilities.length === 0
      && this.services.length === 0
      && Object.keys(this.cognitive).length === 0;
  }
}

module.exports = { Context };
