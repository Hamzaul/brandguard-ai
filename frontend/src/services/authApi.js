// Account, approval-workflow and team calls. Shares the request helper (timeouts, error messages) with reviewApi.
import { request } from "./reviewApi.js";

const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const signup = (name, email, password) => request("/api/auth/signup", json("POST", { name, email, password }));
export const login = (email, password) => request("/api/auth/login", json("POST", { email, password }));
export const fetchMe = () => request("/api/auth/me");

export const listSubmissions = () => request("/api/submissions").then((d) => d.submissions);
export const createSubmission = (title, text, brandProfile) =>
  request("/api/submissions", json("POST", { title, text, brandProfile })).then((d) => d.submission);
export const resubmitSubmission = (id, title, text) =>
  request(`/api/submissions/${id}`, json("PUT", { title, text })).then((d) => d.submission);
export const decideSubmission = (id, decision, comment) =>
  request(`/api/submissions/${id}/decision`, json("POST", { decision, comment })).then((d) => d.submission);

export const fetchInsights = () => request("/api/insights");
export const listUsers = () => request("/api/users").then((d) => d.users);
export const changeRole = (id, role) => request(`/api/users/${id}/role`, json("PATCH", { role })).then((d) => d.user);
