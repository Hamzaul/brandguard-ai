import React from "react";

const STATUS = {
  pending: { label: "Pending review", className: "status-pending" },
  approved: { label: "Approved", className: "status-approved" },
  changes_requested: { label: "Changes requested", className: "status-changes" },
};

export function StatusBadge({ status }) {
  const { label, className } = STATUS[status] || { label: status, className: "status-pending" };
  return <span className={`status-badge ${className}`}>{label}</span>;
}

export function ScoreBadge({ score, label }) {
  const tone = score >= 90 ? "great" : score >= 70 ? "good" : score >= 50 ? "warn" : "bad";
  return <span className={`score-badge score-${tone}`} title="Brand Compliance Score">{score}<small>/100</small>{label ? <em>{label}</em> : null}</span>;
}
