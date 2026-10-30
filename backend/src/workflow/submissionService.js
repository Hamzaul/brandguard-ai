import { randomUUID } from "node:crypto";
import { getJson, setJson } from "../store/store.js";
import { reviewContent } from "../services/reviewService.js";
import { complianceScore, scoreLabel } from "./score.js";
import { AuthError } from "../auth/authService.js";

const subKey = (id) => `sub:${id}`;

export function createSubmissionService({ store, review = reviewContent }) {
  async function log(actor, action, detail) {
    await store.lpush("activity", JSON.stringify({ at: new Date().toISOString(), actorId: actor.id, actorName: actor.name, action, detail }));
  }

  async function load(id) {
    const sub = await getJson(store, subKey(id));
    if (!sub) throw new AuthError(404, "NOT_FOUND", "Submission not found.");
    return sub;
  }

  const canSee = (user, sub) => user.role !== "creator" || sub.authorId === user.id;

  // The server re-runs the review itself, so a client can never fake its score.
  async function snapshot(text, brandProfile) {
    const result = await review({ text, brandProfile });
    const score = complianceScore(result.issues);
    return { issues: result.issues, revisedDraft: result.revisedDraft, analysisMode: result.analysisMode, score, scoreLabel: scoreLabel(score) };
  }

  return {
    async create(user, { title, text, brandProfile }) {
      const now = new Date().toISOString();
      const sub = {
        id: randomUUID(), title, text, brandProfile, authorId: user.id, authorName: user.name,
        status: "pending", decisions: [], createdAt: now, updatedAt: now,
        ...(await snapshot(text, brandProfile)),
      };
      await setJson(store, subKey(sub.id), sub);
      await store.sadd("subs", sub.id);
      await log(user, "submitted", `${sub.title} (score ${sub.score})`);
      return sub;
    },

    async list(user) {
      const ids = await store.smembers("subs");
      const all = (await Promise.all(ids.map((id) => getJson(store, subKey(id))))).filter(Boolean);
      return all.filter((sub) => canSee(user, sub)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async get(user, id) {
      const sub = await load(id);
      if (!canSee(user, sub)) throw new AuthError(404, "NOT_FOUND", "Submission not found.");
      return sub;
    },

    async decide(user, id, { decision, comment }) {
      const sub = await load(id);
      if (sub.status !== "pending") throw new AuthError(409, "INVALID_STATE", "This submission is not waiting for a decision.");
      if (sub.authorId === user.id) throw new AuthError(403, "FORBIDDEN", "You cannot review your own submission.");
      sub.status = decision === "approve" ? "approved" : "changes_requested";
      sub.decisions.push({ by: user.id, byName: user.name, decision, comment, at: new Date().toISOString() });
      sub.updatedAt = new Date().toISOString();
      await setJson(store, subKey(id), sub);
      await log(user, decision === "approve" ? "approved" : "requested changes", sub.title);
      return sub;
    },

    async resubmit(user, id, { title, text }) {
      const sub = await load(id);
      if (sub.authorId !== user.id) throw new AuthError(404, "NOT_FOUND", "Submission not found.");
      if (sub.status !== "changes_requested") throw new AuthError(409, "INVALID_STATE", "Only submissions with requested changes can be edited.");
      Object.assign(sub, { title: title || sub.title, text }, await snapshot(text, sub.brandProfile));
      sub.status = "pending";
      sub.updatedAt = new Date().toISOString();
      await setJson(store, subKey(id), sub);
      await log(user, "resubmitted", `${sub.title} (score ${sub.score})`);
      return sub;
    },

    async insights(user) {
      const subs = await this.list(user);
      const count = (status) => subs.filter((s) => s.status === status).length;
      const decided = count("approved") + count("changes_requested");
      const result = {
        total: subs.length, pending: count("pending"), approved: count("approved"), changesRequested: count("changes_requested"),
        averageScore: subs.length ? Math.round(subs.reduce((sum, s) => sum + s.score, 0) / subs.length) : null,
        approvalRate: decided ? Math.round((count("approved") / decided) * 100) : null,
      };
      if (user.role === "manager") {
        result.activity = (await store.lrange("activity", 25)).map((raw) => { try { return JSON.parse(raw); } catch { return null; } }).filter(Boolean);
      }
      return result;
    },
  };
}
