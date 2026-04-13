/**
 * IContextProvider — abstract interface for assembling mind's context.
 *
 * Context is the bundle of everything mind needs from memory to make decisions:
 * plans, capabilities, cognitive state, history, service health, resources.
 *
 * The data layer is responsible for gathering this from multiple sources
 * (TOML files, knowledge service, session state) and returning a single Context.
 *
 * Implementations: data/repositories/context_assembler.js
 */

class IContextProvider {
  /**
   * Assemble full context for decision-making.
   * @returns {Promise<import('../entities/context').Context>}
   */
  async getContext() {
    throw new Error("IContextProvider.getContext() not implemented");
  }

  /**
   * Get just the service health snapshot (lightweight, for watchdog ticks).
   * @returns {Promise<import('../entities/service').Service[]>}
   */
  async getServiceHealth() {
    throw new Error("IContextProvider.getServiceHealth() not implemented");
  }
}

module.exports = { IContextProvider };
