import React, { useEffect, useState } from "react";
import PageHeading from "../components/PageHeading.jsx";
import { fetchInsights, listUsers, changeRole } from "../services/authApi.js";

const ROLE_LABELS = { creator: "Creator", reviewer: "Reviewer", manager: "Manager" };
const formatDate = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const pct = (value) => (value === null || value === undefined ? "-" : `${value}%`);

export default function TeamPage({ user }) {
  const [insights, setInsights] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const isManager = user.role === "manager";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [data, people] = await Promise.all([fetchInsights(), isManager ? listUsers() : Promise.resolve([])]);
        if (!cancelled) { setInsights(data); setUsers(people); }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isManager]);

  async function updateRole(id, role) {
    setError("");
    try {
      const updated = await changeRole(id, role);
      setUsers((current) => current.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeading eyebrow="TEAM INSIGHTS" title="How your brand is holding up." subtitle="Compliance scores and approval results across everything your team submitted." />
      {error && <p className="status status-error" role="alert">{error}</p>}
      {!insights ? <section className="card"><p className="card-sub">Loading...</p></section> : (
        <>
          <div className="stat-row">
            <section className="card stat-card"><p className="card-sub">Average compliance score</p><p className="stat-value">{insights.averageScore ?? "-"}</p></section>
            <section className="card stat-card"><p className="card-sub">Approval rate</p><p className="stat-value">{pct(insights.approvalRate)}</p></section>
            <section className="card stat-card"><p className="card-sub">Waiting for review</p><p className="stat-value">{insights.pending}</p></section>
          </div>
          {isManager && (
            <div className="two-col even">
              <section className="card" aria-label="Team members">
                <div className="card-head"><div><h2>Team members</h2><p className="card-sub">New sign-ups start as Creators.</p></div></div>
                <ul className="history-list">
                  {users.map((u) => (
                    <li key={u.id} className="history-item">
                      <div><strong>{u.name}</strong><p className="history-meta">{u.email}</p></div>
                      {u.id === user.id ? <span className="chip">{ROLE_LABELS[u.role]} (you)</span> : (
                        <select className="input role-select" aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => updateRole(u.id, e.target.value)}>
                          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card" aria-label="Recent activity">
                <div className="card-head"><div><h2>Recent activity</h2><p className="card-sub">Latest actions across the workspace.</p></div></div>
                {(insights.activity || []).length === 0 ? <p className="card-sub spaced-top">No activity yet.</p> : (
                  <ul className="history-list">
                    {insights.activity.map((a, i) => (
                      <li key={i} className="history-item">
                        <div><p className="history-text" style={{ margin: 0 }}><strong>{a.actorName}</strong> {a.action}: {a.detail}</p><p className="history-meta">{formatDate(a.at)}</p></div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
