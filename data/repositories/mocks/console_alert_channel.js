/**
 * ConsoleAlertChannel — default in-tree mock for IAlertChannel.
 *
 * console.log alerts with a structured prefix. Tests can swap console.log for
 * a capturing function via opts.sink.
 */

const { IAlertChannel } = require("../../../domain/repositories/i_alert_channel");

class ConsoleAlertChannel extends IAlertChannel {
  constructor(opts = {}) {
    super();
    this._sink = opts.sink || ((line) => console.log(line));
    this._sent = [];
  }

  async send(target, message, priority = "normal") {
    const line = `[mock-alert ${priority} → ${target}] ${message}`;
    this._sink(line);
    this._sent.push({ at: Date.now(), target, message, priority });
    return { sent: true, channel: "mock-console" };
  }

  async isAvailable() {
    return true;
  }

  // Test-only
  getSent() { return [...this._sent]; }
}

module.exports = { ConsoleAlertChannel };
