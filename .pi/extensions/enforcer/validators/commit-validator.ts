export function validateCommitMessage(
  message: string
): { valid: boolean; issues: string[]; message: string } {
  const issues: string[] = [];

  if (!message || message.trim().length === 0) {
    return {
      valid: false,
      issues: ["Empty commit message"],
      message: "Commit message cannot be empty.",
    };
  }

  const trimmed = message.trim();
  const lines = trimmed.split("\n");
  const subject = lines[0].trim();

  // Check minimum total length
  if (trimmed.length < 50) {
    issues.push(
      `Commit message is too short (${trimmed.length} chars, minimum 50). Describe what changed and why.`
    );
  }

  // Check subject line length
  if (subject.length > 72) {
    issues.push(
      `Subject line is too long (${subject.length} chars, max 72). Move details to the body.`
    );
  }

  // Check for body (blank line separator + content)
  const hasBlankLine = lines.length >= 2 && lines[1].trim() === "";
  const bodyLines = hasBlankLine
    ? lines.slice(2).filter((l) => l.trim().length > 0)
    : [];

  if (!hasBlankLine || bodyLines.length < 2) {
    issues.push(
      "Missing commit body — add a blank line after the subject, then explain what changed and why (at least 2 lines)."
    );
  }

  // Check that body doesn't just repeat the subject
  if (bodyLines.length > 0) {
    const bodyText = bodyLines.join(" ").toLowerCase();
    const subjectLower = subject.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    if (bodyText.includes(subjectLower) && bodyLines.length < 3) {
      issues.push(
        "Commit body seems to just repeat the subject. Explain *why* the change was made and *how* it works."
      );
    }
  }

  if (issues.length === 0) {
    return {
      valid: true,
      issues: [],
      message: "Commit message meets quality standards.",
    };
  }

  return {
    valid: false,
    issues,
    message: `Commit message issues:\n${issues.map((i) => `  - ${i}`).join("\n")}`,
  };
}
