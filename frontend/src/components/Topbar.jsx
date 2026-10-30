import React, { useState } from "react";
import { HelpIcon, BellIcon } from "./Icons.jsx";

// One small dropdown at a time; clicking the backdrop closes it.
function Menu({ title, children }) {
  return (
    <div className="menu" role="dialog" aria-label={title}>
      <p className="menu-title">{title}</p>
      {children}
    </div>
  );
}

const ROLE_LABELS = { creator: "Creator", reviewer: "Reviewer", manager: "Manager" };

export default function Topbar({ pageLabel, brandName, initials, user, onLogout }) {
  const [open, setOpen] = useState(null); // "help" | "bell" | "account" | null
  const toggle = (name) => setOpen((current) => (current === name ? null : name));

  return (
    <header className="topbar">
      {open && <button type="button" className="menu-backdrop" aria-label="Close menu" onClick={() => setOpen(null)} />}
      <div className="crumbs">
        <strong>Workspace</strong>
        <span className="crumb-sep">/</span>
        <span>{pageLabel}</span>
      </div>
      <div className="topbar-right">
        <div className="profile-pill"><span className="dot" />Brand profile: {brandName}</div>
        <div className="menu-wrap">
          <button type="button" className="icon-button" aria-label="Help" onClick={() => toggle("help")}><HelpIcon size={20} /></button>
          {open === "help" && (
            <Menu title="How it works">
              <p>1. Pick or edit a brand profile.</p>
              <p>2. Paste your copy and run a review.</p>
              <p>3. Check each finding, then copy the suggested revision.</p>
              <p className="menu-note">Findings are advisory. A person must approve content before it is published.</p>
            </Menu>
          )}
        </div>
        <div className="menu-wrap">
          <button type="button" className="icon-button" aria-label="Notifications" onClick={() => toggle("bell")}><BellIcon size={20} /></button>
          {open === "bell" && <Menu title="Notifications"><p className="menu-note">You are all caught up.</p></Menu>}
        </div>
        <div className="menu-wrap">
          <button type="button" className="avatar avatar-button" aria-label="Your account" onClick={() => toggle("account")}>{initials}</button>
          {open === "account" && user && (
            <Menu title={user.name}>
              <p className="menu-note">{user.email}</p>
              <p><span className="chip">{ROLE_LABELS[user.role] || user.role}</span></p>
              <button type="button" className="btn-outline menu-signout" onClick={onLogout}>Sign out</button>
            </Menu>
          )}
        </div>
      </div>
    </header>
  );
}
