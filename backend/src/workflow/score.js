// Brand Compliance Score: 100 means no findings. Each finding lowers it by severity.
const PENALTY = { high: 15, medium: 8, low: 3 };

export function complianceScore(issues) {
  const penalty = issues.reduce((sum, issue) => sum + (PENALTY[issue.severity] ?? 3), 0);
  return Math.max(0, 100 - penalty);
}

export function scoreLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs work";
  return "At risk";
}
