import { AuthError } from "./authService.js";

export function createAuthMiddleware(auth) {
  async function requireAuth(req, res, next) {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      const user = token ? await auth.authenticate(token) : null;
      if (!user) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } });
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  }

  // Authorization: only the listed roles may continue.
  const requireRole = (...roles) => (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission to do this." } });

  return { requireAuth, requireRole };
}

// Turns AuthError into a clean JSON response; anything else goes to the app's error handler.
export function authErrorHandler(error, req, res, next) {
  if (error instanceof AuthError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  next(error);
}
