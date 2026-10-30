// Very small in-memory limiter for login/signup (per instance; good enough to slow guessing).
export function createRateLimiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) hits.set(key, { count: 1, reset: now + windowMs });
    else if (++entry.count > max) {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a few minutes and try again." } });
    }
    next();
  };
}
