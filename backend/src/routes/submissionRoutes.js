import { Router } from "express";
import { validateReviewRequest } from "../validators/requestSchema.js";
import { config } from "../config/env.js";

const bad = (res, errors) => res.status(400).json({ error: { code: "INVALID_REQUEST", message: errors[0], details: errors } });
const cleanTitle = (value, fallback = "Untitled draft") =>
  (typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback);

export function createSubmissionRouter({ submissions, middleware }) {
  const router = Router();
  const { requireAuth, requireRole } = middleware;
  router.use(["/submissions", "/insights"], requireAuth); // only our paths, never other /api routes

  router.post("/submissions", async (req, res, next) => {
    const v = validateReviewRequest(req.body, config.maxTextLength);
    if (!v.ok) return bad(res, v.errors);
    try {
      res.status(201).json({ submission: await submissions.create(req.user, { title: cleanTitle(req.body.title), ...v.value }) });
    } catch (e) { next(e); }
  });

  router.get("/submissions", async (req, res, next) => {
    try { res.json({ submissions: await submissions.list(req.user) }); } catch (e) { next(e); }
  });

  router.get("/insights", requireRole("reviewer", "manager"), async (req, res, next) => {
    try { res.json(await submissions.insights(req.user)); } catch (e) { next(e); }
  });

  router.get("/submissions/:id", async (req, res, next) => {
    try { res.json({ submission: await submissions.get(req.user, req.params.id) }); } catch (e) { next(e); }
  });

  router.post("/submissions/:id/decision", requireRole("reviewer", "manager"), async (req, res, next) => {
    const decision = req.body?.decision;
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim().slice(0, 500) : "";
    if (!["approve", "request_changes"].includes(decision)) return bad(res, ["Decision must be approve or request_changes."]);
    if (decision === "request_changes" && !comment) return bad(res, ["Please add a comment explaining the requested changes."]);
    try { res.json({ submission: await submissions.decide(req.user, req.params.id, { decision, comment }) }); } catch (e) { next(e); }
  });

  router.put("/submissions/:id", async (req, res, next) => {
    const v = validateReviewRequest({ text: req.body?.text }, config.maxTextLength);
    if (!v.ok) return bad(res, v.errors);
    try {
      const title = typeof req.body?.title === "string" ? cleanTitle(req.body.title, "") : "";
      res.json({ submission: await submissions.resubmit(req.user, req.params.id, { title, text: v.value.text }) });
    } catch (e) { next(e); }
  });

  return router;
}
