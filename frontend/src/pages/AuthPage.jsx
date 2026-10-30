import React, { useState } from "react";
import { ShieldCheckIcon } from "../components/Icons.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isSignup) await signup(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isSignup ? "login" : "signup");
    setError("");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card card">
        <div className="brand auth-brand">
          <span className="brand-logo"><ShieldCheckIcon size={20} /></span>
          <span className="brand-name">BrandGuard AI</span>
        </div>
        <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="card-sub">{isSignup ? "New accounts start as Creators. A manager can change roles later." : "Sign in to review content and manage approvals."}</p>
        <form onSubmit={submit} noValidate>
          {isSignup && (
            <div className="field">
              <label htmlFor="auth-name">Full name</label>
              <input id="auth-name" className="input" autoComplete="name" value={form.name} onChange={set("name")} />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" className="input" autoComplete="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" type="password" className="input" autoComplete={isSignup ? "new-password" : "current-password"}
              value={form.password} onChange={set("password")} />
            {isSignup && <small>At least 8 characters, with a letter and a number.</small>}
          </div>
          {error && <p className="status status-error auth-error" role="alert">{error}</p>}
          <button type="submit" className="btn-primary auth-submit" disabled={busy}>
            {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New to BrandGuard AI?"}{" "}
          <button type="button" className="link-button" onClick={switchMode}>{isSignup ? "Sign in" : "Create an account"}</button>
        </p>
      </div>
    </div>
  );
}
