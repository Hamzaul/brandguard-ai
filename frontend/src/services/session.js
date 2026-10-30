// Keeps the sign-in token in this browser. Falls back quietly if storage is blocked.
const KEY = "brandguard.token";
export const UNAUTHORIZED_EVENT = "brandguard:unauthorized";

export function getToken() {
  try { return window.localStorage.getItem(KEY) || ""; } catch { return ""; }
}
export function setToken(token) {
  try { window.localStorage.setItem(KEY, token); } catch { /* storage blocked */ }
}
export function clearToken() {
  try { window.localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
