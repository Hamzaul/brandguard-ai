import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageHeading from "../components/PageHeading.jsx";
import FindingCard from "../components/FindingCard.jsx";
import { StatusBadge, ScoreBadge } from "../components/Badges.jsx";
import { listSubmissions, decideSubmission, resubmitSubmission } from "../services/authApi.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "changes_requested", label: "Changes" },
];
const formatDate = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function ApprovalsPage({ user, refreshKey, onNavigate }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const canDecide = user.role === "reviewer" || user.role === "manager";

  const load = useCallback(async () => {
    try {
      const data = await listSubmissions();
      setItems(data);
      setError("");
    } catch (err) {
      setError(err.message);
      setItems((current) => current ?? []);
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const visible = useMemo(() => (items || []).filter((s) => filter === "all" || s.status === filter), [items, filter]);
  const selected = (items || []).find((s) => s.id === selectedId) || visible[0] || null;

  function replace(updated) {
    setItems((current) => current.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedId(updated.id);
  }

  return (
    <>
      <PageHeading
        eyebrow="APPROVALS"
        title={canDecide ? "Review what your team submits." : "Track your submissions."}
        subtitle={canDecide
          ? "Approve copy or send it back with a comment. You cannot decide on your own submissions."
          : "Submit a draft from Content Review. A reviewer approves it or asks for changes."}
      />
      {error && <p className="status status-error" role="alert">{error}</p>}
      {items === null ? (
        <section className="card"><p className="card-sub">Loading submissions...</p></section>
      ) : items.length === 0 ? (
        <section className="card empty-card">
          <h2>No submissions yet</h2>
          <p className="card-sub">{canDecide ? "Nothing has been submitted for approval yet." : "Review a draft, then choose Submit for approval."}</p>
          <button type="button" className="btn-primary" onClick={() => onNavigate("review")}>Go to Content Review</button>
        </section>
      ) : (
        <div className="two-col even">
          <section className="card" aria-label="Submissions">
            <div className="filter-row" role="group" aria-label="Filter by status">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={filter === f.id ? "filter active" : "filter"} onClick={() => setFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            {visible.length === 0 ? <p className="card-sub spaced-top">Nothing in this view.</p> : (
              <ul className="history-list">
                {visible.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={selected?.id === s.id ? "sub-item selected" : "sub-item"} onClick={() => setSelectedId(s.id)}>
                      <span className="sub-top"><strong>{s.title}</strong><ScoreBadge score={s.score} /></span>
                      <span className="history-meta">{s.authorName} · {formatDate(s.createdAt)}</span>
                      <StatusBadge status={s.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {selected && <SubmissionDetail key={selected.id + selected.updatedAt} user={user} sub={selected} canDecide={canDecide} onUpdated={replace} />}
        </div>
      )}
      <p className="page-footnote">AI suggestions support human review and approval.</p>
    </>
  );
}

function SubmissionDetail({ user, sub, canDecide, onUpdated }) {
  const [comment, setComment] = useState("");
  const [text, setText] = useState(sub.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isOwner = sub.authorId === user.id;
  const showDecision = canDecide && sub.status === "pending" && !isOwner;
  const showResubmit = isOwner && sub.status === "changes_requested";

  async function run(action) {
    setBusy(true);
    setError("");
    try { onUpdated(await action()); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <section className="card" aria-label="Submission details">
      <div className="card-head">
        <div>
          <h2>{sub.title}</h2>
          <p className="card-sub">{sub.authorName} · {formatDate(sub.createdAt)}</p>
        </div>
        <StatusBadge status={sub.status} />
      </div>
      <div className="score-row">
        <ScoreBadge score={sub.score} label={sub.scoreLabel} />
        <span className="card-sub">{sub.issues.length} {sub.issues.length === 1 ? "finding" : "findings"} · checked by the server</span>
      </div>

      <div className="card-divider spaced" />
      <h3 className="sub-heading">Draft</h3>
      {showResubmit ? (
        <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit draft" />
      ) : (
        <div className="revision-box">{sub.text}</div>
      )}

      {sub.issues.length > 0 && (
        <>
          <h3 className="sub-heading">Findings</h3>
          <div className="findings">{sub.issues.map((issue, i) => <FindingCard key={i} issue={issue} />)}</div>
        </>
      )}

      {sub.decisions.length > 0 && (
        <>
          <h3 className="sub-heading">Decisions</h3>
          <ul className="decision-list">
            {[...sub.decisions].reverse().map((d, i) => (
              <li key={i}>
                <strong>{d.byName}</strong> {d.decision === "approve" ? "approved" : "requested changes"} <span className="history-meta">· {formatDate(d.at)}</span>
                {d.comment && <p>{d.comment}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {showDecision && (
        <>
          <div className="card-divider spaced" />
          <div className="field">
            <label htmlFor="decision-comment">Comment (required when requesting changes)</label>
            <textarea id="decision-comment" className="input" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="button-row left">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => run(() => decideSubmission(sub.id, "approve", comment))}>Approve</button>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => run(() => decideSubmission(sub.id, "request_changes", comment))}>Request changes</button>
          </div>
        </>
      )}
      {showResubmit && (
        <div className="button-row left">
          <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={() => run(() => resubmitSubmission(sub.id, sub.title, text))}>
            {busy ? "Submitting..." : "Resubmit for approval"}
          </button>
        </div>
      )}
      {error && <p className="status status-error spaced-top" role="alert">{error}</p>}
    </section>
  );
}
