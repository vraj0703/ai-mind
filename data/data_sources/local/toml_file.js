/**
 * TOML file reader/writer using smol-toml for parsing
 * and a minimal serializer for writing.
 */

const fs = require("fs");
const path = require("path");
const TOML = require("smol-toml");

function readToml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  return TOML.parse(content);
}

/**
 * Simple TOML serializer for flat/shallow objects.
 * Handles: strings, numbers, booleans, arrays of primitives, one level of nesting.
 */
function serializeToml(obj, header = "") {
  const lines = [];
  if (header) lines.push(`# ${header}`, "");

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      lines.push("", `[${key}]`);
      for (const [k, v] of Object.entries(value)) {
        lines.push(`${k} = ${formatValue(v)}`);
      }
    } else {
      lines.push(`${key} = ${formatValue(value)}`);
    }
  }

  return lines.join("\n") + "\n";
}

function formatValue(v) {
  if (typeof v === "string") return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.map(formatValue).join(", ")}]`;
  return `"${String(v)}"`;
}

function writeToml(filePath, obj, header = "") {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, serializeToml(obj, header), "utf-8");
}

function appendJsonl(filePath, entry) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
}

module.exports = { readToml, writeToml, serializeToml, appendJsonl };
