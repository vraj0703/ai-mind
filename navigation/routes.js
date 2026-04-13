/**
 * Route definitions — maps URL patterns to controller methods.
 */

const path = require("path");

function registerRoutes(app, { supervisor, router }) {

  // ─── Visualization page ───
  app.get("/visualize", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "presentation", "pages", "visualize.html"));
  });

  // ─── Health ───
  app.get("/health", (req, res) => {
    res.json({ status: "running", service: "mind-v2", version: "2.0.0" });
  });

  // ─── Supervisor status ───
  app.get("/status", (req, res) => {
    res.json(supervisor.getStatus());
  });

  // ─── Chat / message processing ───
  app.post("/chat", async (req, res) => {
    try {
      const { decision, route } = await router.handleMessage(req.body);
      res.json({
        response: decision.payload,
        tier: route.tier,
        handler: route.handler,
        model: decision.model,
        confidence: decision.confidence,
        decisionId: decision.id,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Terminal inbox (for Mr. V) ───
  app.get("/terminal/inbox", (req, res) => {
    const status = req.query.status || "pending";
    res.json(router.getInbox(status));
  });

  app.post("/terminal/respond/:id", (req, res) => {
    const item = router.respondToInboxItem(req.params.id, req.body.response);
    if (!item) return res.status(404).json({ error: "inbox item not found" });
    res.json(item);
  });

  // ─── SSE stream ───
  app.get("/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");
    router.addSSEClient(res);
    req.on("close", () => router.removeSSEClient(res));
  });

  // ─── Decisions log ───
  app.get("/decisions", (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(supervisor.getStatus().recentDecisions.slice(0, limit));
  });
}

module.exports = { registerRoutes };
