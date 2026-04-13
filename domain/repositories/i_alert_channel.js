/**
 * IAlertChannel — abstract interface for sending alerts to PM or Mr. V.
 *
 * When mind needs to escalate (service down, plan blocked, urgent message),
 * it calls an alert channel. The data layer decides whether that's WhatsApp,
 * phone vibration, SMS, dashboard SSE, or a mock.
 *
 * Implementations: data/repositories/whatsapp_alert_channel.js, etc.
 */

class IAlertChannel {
  /**
   * Send an alert message.
   * @param {string} target     - "pm" | "mr-v" | "alerts-reports"
   * @param {string} message    - the alert text
   * @param {string} [priority] - "normal" | "urgent"
   * @returns {Promise<{sent: boolean, channel: string, error?: string}>}
   */
  async send(target, message, priority = "normal") {
    throw new Error("IAlertChannel.send() not implemented");
  }

  /**
   * Check if this channel is available (e.g., WhatsApp gateway is up).
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error("IAlertChannel.isAvailable() not implemented");
  }
}

module.exports = { IAlertChannel };
