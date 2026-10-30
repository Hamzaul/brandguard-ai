import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { reviewRouter } from "./routes/reviewRoutes.js";
import { brandRouter } from "./routes/brandRoutes.js";
import { createStore } from "./store/store.js";
import { createAuthService } from "./auth/authService.js";
import { createAuthMiddleware, authErrorHandler } from "./auth/middleware.js";
import { createAuthRouter } from "./routes/authRoutes.js";
import { createSubmissionRouter } from "./routes/submissionRoutes.js";
import { createSubmissionService } from "./workflow/submissionService.js";

export function createApp({ store = createStore(), jwtSecret = config.jwtSecret } = {}) {
  const app = express();

  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "50kb" })); // request-size limit

  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "brandguard-backend" }));
  const auth = createAuthService({ store, secret: jwtSecret, adminEmails: config.adminEmails });
  const middleware = createAuthMiddleware(auth);
  app.use("/api", createAuthRouter({ auth, middleware }));
  app.use("/api", createSubmissionRouter({ submissions: createSubmissionService({ store }), middleware }));

  // Reviewing content now requires a signed-in user (same route, same response).
  app.use("/api/review", middleware.requireAuth);
  app.use("/api", reviewRouter);
  app.use("/api", brandRouter);

  app.use((req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use(authErrorHandler);

  // Last-resort handler (e.g. malformed JSON). Never leaks stack traces.
  app.use((error, req, res, next) => {
    const isBadJson = error.type === "entity.parse.failed";
    const isTooLarge = error.type === "entity.too.large";
    const status = isBadJson ? 400 : isTooLarge ? 413 : 500;
    const message = isBadJson
      ? "Request body is not valid JSON."
      : isTooLarge
        ? "Request is too large."
        : "Unexpected server error.";
    res.status(status).json({ error: { code: "REQUEST_ERROR", message } });
  });

  return app;
}
export default createApp();
