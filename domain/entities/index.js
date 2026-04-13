/**
 * Domain entities — the nouns of the mind system.
 *
 * These are pure data shapes with validation.
 * No external dependencies. No I/O. No side effects.
 * Testable with nothing but Node's built-in assert.
 */

module.exports = {
  ...require("./input"),
  ...require("./decision"),
  ...require("./tier"),
  ...require("./service"),
  ...require("./plan"),
  ...require("./context"),
  ...require("./delegation_level"),
  ...require("./task_score"),
};
