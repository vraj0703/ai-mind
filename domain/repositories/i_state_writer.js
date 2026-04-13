/**
 * IStateWriter — abstract interface for persisting mind's state.
 *
 * Mind writes: session state, heartbeat, decision log.
 * The data layer decides format (TOML, JSONL, database).
 *
 * Implementations: data/repositories/file_state_writer.js
 */

class IStateWriter {
  /**
   * Write session state (service health, uptime, recent decisions).
   * @param {object} sessionState
   * @returns {Promise<void>}
   */
  async writeSession(sessionState) {
    throw new Error("IStateWriter.writeSession() not implemented");
  }

  /**
   * Write heartbeat (system health snapshot).
   * @param {object} heartbeat
   * @returns {Promise<void>}
   */
  async writeHeartbeat(heartbeat) {
    throw new Error("IStateWriter.writeHeartbeat() not implemented");
  }

  /**
   * Append a decision to the log.
   * @param {import('../entities/decision').Decision} decision
   * @returns {Promise<void>}
   */
  async logDecision(decision) {
    throw new Error("IStateWriter.logDecision() not implemented");
  }
}

module.exports = { IStateWriter };
