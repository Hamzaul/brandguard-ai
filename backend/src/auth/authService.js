import { randomUUID } from "node:crypto";
import { getJson, setJson } from "../store/store.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./crypto.js";

export class AuthError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const publicUser = ({ id, name, email, role, createdAt }) => ({ id, name, email, role, createdAt });
const emailKey = (email) => `email:${email}`;
const userKey = (id) => `user:${id}`;

export function createAuthService({ store, secret, adminEmails = [] }) {
  const requireSecret = () => {
    if (!secret) throw new AuthError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured on the server (JWT_SECRET missing).");
  };
  const issue = (user) => signToken({ sub: user.id, role: user.role }, secret);

  async function findByEmail(email) {
    const id = await store.get(emailKey(email));
    return id ? getJson(store, userKey(id)) : null;
  }

  return {
    async signup({ name, email, password }) {
      requireSecret();
      const id = randomUUID();
      // Atomic claim of the email so two simultaneous signups cannot both win.
      if (!(await store.setIfAbsent(emailKey(email), id))) {
        throw new AuthError(409, "EMAIL_TAKEN", "An account with this email already exists.");
      }
      const existing = await store.smembers("users");
      // First account (or an ADMIN_EMAILS match) becomes manager; everyone else starts as creator.
      const role = existing.length === 0 || adminEmails.includes(email) ? "manager" : "creator";
      const user = { id, name, email, role, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
      await setJson(store, userKey(id), user);
      await store.sadd("users", id);
      return { token: issue(user), user: publicUser(user) };
    },

    async login({ email, password }) {
      requireSecret();
      const user = await findByEmail(email);
      // Same message for unknown email and wrong password.
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throw new AuthError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
      }
      return { token: issue(user), user: publicUser(user) };
    },

    // Re-reads the user on every request, so role changes take effect immediately.
    async authenticate(token) {
      requireSecret();
      const payload = verifyToken(token, secret);
      if (!payload) return null;
      const user = await getJson(store, userKey(payload.sub));
      return user ? publicUser(user) : null;
    },

    async listUsers() {
      const ids = await store.smembers("users");
      const users = await Promise.all(ids.map((id) => getJson(store, userKey(id))));
      return users.filter(Boolean).map(publicUser).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async setRole(actorId, targetId, role) {
      const target = await getJson(store, userKey(targetId));
      if (!target) throw new AuthError(404, "NOT_FOUND", "User not found.");
      if (actorId === targetId) throw new AuthError(400, "INVALID_REQUEST", "You cannot change your own role.");
      target.role = role;
      await setJson(store, userKey(targetId), target);
      return publicUser(target);
    },
  };
}
