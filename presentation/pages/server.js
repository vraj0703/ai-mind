/**
 * Mind v2 HTTP Server — the presentation layer entry point.
 */

const express = require("express");
const { registerRoutes } = require("../../navigation/routes");

function createServer({ supervisor, router, port }) {
  const app = express();
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      if (req.path !== "/health") {
        console.log(`[http] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
      }
    });
    next();
  });

  registerRoutes(app, { supervisor, router });

  return {
    app,
    listen: () => new Promise((resolve) => {
      const server = app.listen(port, "127.0.0.1", () => {
        console.log(`[mind-v2] listening on http://127.0.0.1:${port}`);
        resolve(server);
      });
    }),
  };
}

module.exports = { createServer };
