import React, { useEffect, useState } from "react";
import Sidebar, { PAGES, pagesForRole } from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import BrandProfilesPage from "./pages/BrandProfilesPage.jsx";
import ContentReviewPage from "./pages/ContentReviewPage.jsx";
import ReviewHistoryPage from "./pages/ReviewHistoryPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import ApprovalsPage from "./pages/ApprovalsPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import { useAuth } from "./auth/AuthContext.jsx";
import { createSubmission } from "./services/authApi.js";
import useLocalStorage from "./hooks/useLocalStorage.js";
import { reviewContent } from "./services/reviewApi.js";
import { createHistoryEntry, addEntry } from "./utils/history.js";
import { DEFAULT_PROFILE, SAMPLE_CONTENT, SAMPLE_REVIEW } from "./utils/sampleData.js";

const pageFromHash = (allowed) => {
  const id = window.location.hash.replace("#", "");
  return allowed.some((page) => page.id === id) ? id : "review";
};

const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "AC";

export default function App() {
  const { user, logout } = useAuth();
  const allowedPages = pagesForRole(user.role);
  const [page, setPage] = useState(() => pageFromHash(allowedPages));
  // Browser data is kept per account, so people sharing a computer never see each other's drafts.
  const [profile, setProfile] = useLocalStorage(`brandguard.profile.${user.id}`, DEFAULT_PROFILE);
  const [history, setHistory] = useLocalStorage(`brandguard.history.${user.id}`, []);
  const [settings, setSettings] = useLocalStorage(`brandguard.settings.${user.id}`, { initials: initialsOf(user.name) });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [approvalsVersion, setApprovalsVersion] = useState(0);
  const [text, setText] = useState(SAMPLE_CONTENT);
  const [review, setReview] = useState({ result: SAMPLE_REVIEW, isSample: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash(pagesForRole(user.role)));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [user.role]);

  function navigate(id) {
    window.location.hash = id;
    setPage(id);
  }

  async function runReview() {
    setLoading(true);
    setNotice("");
    setError("");
    try {
      const result = await reviewContent(text, profile);
      setReview({ result, isSample: false });
      setHistory((current) => addEntry(current, createHistoryEntry({ text, profileName: profile.brandName, result })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitForApproval() {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const title = text.trim().replace(/\s+/g, " ").slice(0, 60);
      await createSubmission(title, text, profile);
      setApprovalsVersion((version) => version + 1);
      setNotice("Submitted. A reviewer will see it under Approvals.");
      navigate("approvals");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openFromHistory(entry) {
    setText(entry.text);
    setReview({ result: entry.result, isSample: false });
    setError("");
    navigate("review");
  }

  const pageLabel = PAGES.find((item) => item.id === page).label;
  const initials = settings.initials || initialsOf(user.name);

  return (
    <div className="shell">
      <Sidebar page={page} onNavigate={navigate} pages={allowedPages} />
      <div className="workspace">
        <Topbar pageLabel={pageLabel} brandName={profile.brandName} initials={initials} user={user} onLogout={logout} />
        <main className="main">
          {page === "overview" && <OverviewPage history={history} brandName={profile.brandName} onNavigate={navigate} />}
          {page === "profiles" && <BrandProfilesPage profile={profile} onSave={setProfile} />}
          {page === "review" && (
            <ContentReviewPage brandName={profile.brandName} text={text} onTextChange={setText}
              review={review} loading={loading} error={error} onRun={runReview}
              onSubmitForApproval={submitForApproval} submitting={submitting} notice={notice} />
          )}
          {page === "history" && (
            <ReviewHistoryPage history={history} onOpen={openFromHistory} onNavigate={navigate}
              onDelete={(id) => setHistory((current) => current.filter((entry) => entry.id !== id))} />
          )}
          {page === "approvals" && <ApprovalsPage user={user} refreshKey={approvalsVersion} onNavigate={navigate} />}
          {page === "team" && <TeamPage user={user} />}
          {page === "settings" && (
            <SettingsPage brandName={profile.brandName} initials={initials}
              onInitialsChange={(value) => setSettings({ ...settings, initials: value })}
              historyCount={history.length} onClearHistory={() => setHistory([])}
              onResetProfile={() => setProfile(DEFAULT_PROFILE)} />
          )}
        </main>
      </div>
    </div>
  );
}
