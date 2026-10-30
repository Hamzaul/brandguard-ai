import { Router } from "express";
import { validateSignup, validateLogin, ROLES } from "../auth/validators.js";
import { createRateLimiter } from "../auth/rateLimit.js";

const bad = (res, errors) => res.status(400).json({ error: { code: "INVALID_REQUEST", message: errors[0], details: errors } });

export function createAuthRouter({ auth, middleware }) {
  const router = Router();
  const limiter = createRateLimiter();
  const { requireAuth, requireRole } = middleware;

  router.post("/auth/signup", limiter, async (req, res, next) => {
    const v = validateSignup(req.body);
    if (!v.ok) return bad(res, v.errors);
    try { res.status(201).json(await auth.signup(v.value)); } catch (e) { next(e); }
  });

  router.post("/auth/login", limiter, async (req, res, next) => {
    const v = validateLogin(req.body);
    if (!v.ok) return bad(res, v.errors);
    try { res.json(await auth.login(v.value)); } catch (e) { next(e); }
  });

  router.get("/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

  // Manager-only user administration.
  router.get("/users", requireAuth, requireRole("manager"), async (req, res, next) => {
    try { res.json({ users: await auth.listUsers() }); } catch (e) { next(e); }
  });

  router.patch("/users/:id/role", requireAuth, requireRole("manager"), async (req, res, next) => {
    const role = req.body?.role;
    if (!ROLES.includes(role)) return bad(res, ["Role must be creator, reviewer or manager."]);
    try { res.json({ user: await auth.setRole(req.user.id, req.params.id, role) }); } catch (e) { next(e); }
  });

  return router;
}
