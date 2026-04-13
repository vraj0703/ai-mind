/**
 * WhatsAppAlertChannel — concrete IAlertChannel using WhatsApp gateway.
 */

const { IAlertChannel } = require("../../domain/repositories/i_alert_channel");
const { httpGet, httpPost } = require("../data_sources/remote/http_client");

class WhatsAppAlertChannel extends IAlertChannel {
  constructor(opts = {}) {
    super();
    this.host = opts.host || "http://127.0.0.1:3478";
    this.alertGroup = opts.alertGroup || "alerts-reports";
    this.pmGroup = opts.pmGroup || "general";
  }

  async send(target, message, priority = "normal") {
    const group = target === "pm" ? this.pmGroup
      : target === "mr-v" ? this.pmGroup
      : target === "alerts-reports" ? this.alertGroup
      : this.pmGroup;

    const res = await httpPost(`${this.host}/send-group`, { group, message }, { timeoutMs: 10_000 });

    if (!res.ok) {
      return { sent: false, channel: "whatsapp", error: res.error || `HTTP ${res.status}` };
    }
    return { sent: true, channel: "whatsapp" };
  }

  async isAvailable() {
    const res = await httpGet(`${this.host}/health`, { timeoutMs: 3000 });
    return res.ok;
  }
}

module.exports = { WhatsAppAlertChannel };
