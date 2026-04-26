/**
 * InMemoryStateWriter — default in-tree mock for IStateWriter.
 *
 * Captures all writes in arrays so tests can assert on them. No filesystem.
 */

const { IStateWriter } = require("../../../domain/repositories/i_state_writer");

class InMemoryStateWriter extends IStateWriter {
  constructor() {
    super();
    this._sessions = [];
    this._heartbeats = [];
    this._decisions = [];
  }

  async writeSession(sessionState) {
    this._sessions.push({ at: Date.now(), state: sessionState });
  }

  async writeHeartbeat(heartbeat) {
    this._heartbeats.push({ at: Date.now(), heartbeat });
  }

  async logDecision(decision) {
    this._decisions.push({ at: Date.now(), decision });
  }

  // Test-only helpers — not part of IStateWriter
  getSessions()   { return [...this._sessions]; }
  getHeartbeats() { return [...this._heartbeats]; }
  getDecisions()  { return [...this._decisions]; }
}

module.exports = { InMemoryStateWriter };
