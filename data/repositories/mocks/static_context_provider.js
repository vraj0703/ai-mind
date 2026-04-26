/**
 * StaticContextProvider — default in-tree mock for IContextProvider.
 *
 * Returns a real `Context` entity (not a plain object) so use cases can call
 * `.getDownServices()`, `.getActivePlans()`, etc. without crashing. Empty by
 * default; accepts seed data via constructor.
 */

const { IContextProvider } = require("../../../domain/repositories/i_context_provider");
const { Context } = require("../../../domain/entities/context");

class StaticContextProvider extends IContextProvider {
  constructor(opts = {}) {
    super();
    this._services = opts.services || [];
    this._plans = opts.plans || [];
    this._capabilities = opts.capabilities || [];
  }

  async getContext() {
    return new Context({
      services: [...this._services],
      plans: [...this._plans],
      capabilities: [...this._capabilities],
      cognitive: { reflection: null, attention: null, calibration: null },
      history: [],
      session: { mock: true, timestamp: new Date().toISOString() },
      resources: { cpu: 0, ram: 0, vram: 0 },
    });
  }

  async getServiceHealth() {
    return [...this._services];
  }
}

module.exports = { StaticContextProvider };
