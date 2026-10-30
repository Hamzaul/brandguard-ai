// All calls to the backend live here, so components never deal with fetch details.
import { getToken, clearToken, UNAUTHORIZED_EVENT } from "./session.js";

const API_URL = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 20000;

class ApiError extends Error {}

export async function request(path, options = {}) {
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    const headers = { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    throw new ApiError(
      error.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : "Could not reach the server. Check your connection and try again."
    );
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Body was not JSON - handled below.
  }
  if (response.status === 401 && token) {
    clearToken(); // session expired - send the user back to the sign-in page
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!response.ok) throw new ApiError(data?.error?.message || "The server returned an error. Please try again.");
  if (!data) throw new ApiError("The server sent an unexpected response.");
  return data;
}

function isValidReview(data) {
  return Array.isArray(data.issues) && typeof data.revisedDraft === "string" && typeof data.overallAssessment === "string";
}

export async function reviewContent(text, brandProfile) {
  const data = await request("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, brandProfile }),
  });
  if (!isValidReview(data)) throw new ApiError("The server sent an unexpected response.");
  return data;
}
