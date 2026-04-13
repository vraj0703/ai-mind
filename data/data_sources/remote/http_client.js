/**
 * Minimal HTTP client using Node's built-in fetch.
 * Every outbound call goes through here — one place to add timeouts, logging, retries.
 */

async function httpGet(url, opts = {}) {
  const timeout = opts.timeoutMs || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.text();
    clearTimeout(timer);
    return {
      ok: res.ok,
      status: res.status,
      body: tryParseJson(body),
      raw: body,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, status: 0, body: null, raw: "", error: `timeout after ${timeout}ms` };
    }
    return { ok: false, status: 0, body: null, raw: "", error: err.message };
  }
}

async function httpPost(url, data, opts = {}) {
  const timeout = opts.timeoutMs || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    const body = await res.text();
    clearTimeout(timer);
    return {
      ok: res.ok,
      status: res.status,
      body: tryParseJson(body),
      raw: body,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return { ok: false, status: 0, body: null, raw: "", error: `timeout after ${timeout}ms` };
    }
    return { ok: false, status: 0, body: null, raw: "", error: err.message };
  }
}

function tryParseJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}

module.exports = { httpGet, httpPost };
