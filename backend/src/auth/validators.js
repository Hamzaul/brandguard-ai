const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const ROLES = ["creator", "reviewer", "manager"];

export function validateSignup(body) {
  const errors = [];
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 60) errors.push("Name must be 2 to 60 characters.");
  if (!EMAIL.test(email) || email.length > 120) errors.push("Please enter a valid email address.");
  if (password.length < 8 || password.length > 100) errors.push("Password must be 8 to 100 characters.");
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.push("Password must contain at least one letter and one number.");
  return errors.length ? { ok: false, errors } : { ok: true, value: { name, email, password } };
}

export function validateLogin(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return { ok: false, errors: ["Email and password are required."] };
  return { ok: true, value: { email, password } };
}
