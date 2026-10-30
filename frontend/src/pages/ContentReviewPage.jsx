import React, { useState } from "react";
import PageHeading from "../components/PageHeading.jsx";
import FindingCard from "../components/FindingCard.jsx";
import { ShieldCheckIcon } from "../components/Icons.jsx";
import { MAX_TEXT_LENGTH } from "../utils/sampleData.js";

const countWords = (text) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export default function ContentReviewPage({ brandName, text, onTextChange, review, loading, error, onRun, onSubmitForApproval, submitting, notice }) {
  const [copied, setCopied] = useState(false);
  const words = countWords(text);
  const tooLong = text.length > MAX_TEXT_LENGTH;
  const empty = text.trim().length === 0;
  const { result, isSample } = review;

  async function copyRevision() {
    try {
      await navigator.clipboard.writeText(result.revisedDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // clipboard blocked - the text can still be selected by hand
    }
  }

  let statusMessage = "Checking voice, claims & terminology";
  if (notice) statusMessage = notice;
  if (error) statusMessage = error;
  else if (tooLong) statusMessage = `Over the ${MAX_TEXT_LENGTH}-character limit. Please shorten the draft.`;
  const statusIsError = Boolean(error) || tooLong;

  return (
    <>
      <PageHeading
        eyebrow={`CONTENT REVIEW / ${brandName.toUpperCase()}`}
        title="Every word, on brand."
        subtitle="Review marketing copy against your brand voice, terminology, and compliance rules before it goes live."
      />
      <div className="two-col">
        <section className="card" aria-labelledby="draft-title">
          <div className="card-head">
            <div>
              <h2 id="draft-title">Your draft</h2>
              <p className="card-sub">Make changes below, then run a fresh review.</p>
            </div>
            <span className="chip">Marketing copy</span>
          </div>
          <label className="draft-label" htmlFor="draft">Content to review</label>
          <textarea id="draft" className="draft-input" value={text} disabled={loading}
            placeholder="Paste your marketing copy here..." onChange={(event) => onTextChange(event.target.value)} />
          <div className="draft-meta">
            <span>Edit directly in the draft.</span>
            <span>{words} {words === 1 ? "word" : "words"}</span>
          </div>
          <div className="card-divider" />
          <div className="draft-actions">
            <p className={statusIsError ? "status status-error" : "status"} role={statusIsError ? "alert" : undefined}>
              {!statusIsError && <ShieldCheckIcon size={16} />}
              <span>{statusMessage}</span>
            </p>
            <div className="button-row">
              {onSubmitForApproval && (
                <button type="button" className="btn-outline btn-tall" onClick={onSubmitForApproval} disabled={loading || submitting || empty || tooLong}>
                  {submitting ? "Submitting..." : "Submit for approval"}
                </button>
              )}
              <button type="button" className="btn-primary" onClick={onRun} disabled={loading || empty || tooLong}>
                {loading ? "Reviewing..." : "Review content"}
              </button>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="results-title" aria-live="polite">
          <div className="card-head">
            <div>
              <h2 id="results-title">Review results</h2>
              <p className="card-sub">A clearer path to approved copy.</p>
            </div>
            <span className="chip">{isSample ? "Sample review" : "Live review"}</span>
          </div>
          <div className="card-divider spaced" />
          <div className="findings-head">
            <span>Findings</span>
            <span>{result.issues.length} {result.issues.length === 1 ? "finding" : "findings"}</span>
          </div>
          <div className="findings">
            {result.issues.length === 0 ? (
              <p className="no-findings">No issues were found by the automated checks. A person should still review this copy before it is published.</p>
            ) : (
              result.issues.map((issue, index) => <FindingCard key={`${issue.snippet}-${index}`} issue={issue} />)
            )}
          </div>
          <div className="card-divider spaced-lg" />
          <div className="revision">
            <div className="revision-head">
              <h3>Suggested revision</h3>
              <button type="button" className="btn-outline" onClick={copyRevision}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <div className="revision-box">{result.revisedDraft}</div>
          </div>
        </section>
      </div>
      <p className="page-footnote">AI suggestions support human review and approval.</p>
    </>
  );
}
