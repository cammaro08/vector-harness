import { EnforcementReport, CheckResult, RetryInfo, EscalationInfo } from './enforcementReport';

// ANSI color codes
const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

/**
 * Wrap text with ANSI color codes if color is enabled.
 * @param text The text to colorize
 * @param code The ANSI color code (e.g., '\x1b[32m' for green)
 * @param colorEnabled Whether to apply color
 * @returns Colorized or plain text
 */
export function colorize(text: string, code: string, colorEnabled: boolean): string {
  if (!colorEnabled) {
    return text;
  }
  return `${code}${text}${COLORS.reset}`;
}

/**
 * Format a duration in milliseconds to human-readable format.
 * @param ms Duration in milliseconds
 * @returns Formatted duration string (e.g., "12ms", "1.2s", "1m 5s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  if (ms < 60000) {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Format the header section with blueprint name and task description.
 * @param report The enforcement report
 * @returns Formatted header string
 */
export function formatHeader(report: EnforcementReport): string {
  const lines: string[] = [];
  lines.push(`Blueprint: ${report.blueprintName}`);
  lines.push(`Task:      ${report.taskDescription}`);
  return lines.join('\n');
}

/**
 * Format the checks section with status, name, timing, and details.
 * @param checks Array of check results
 * @param colorEnabled Whether to apply colors
 * @returns Formatted checks string
 */
export function formatChecks(checks: readonly CheckResult[], colorEnabled: boolean): string {
  if (checks.length === 0) {
    return '';
  }

  const lines: string[] = ['CHECKS'];

  for (const check of checks) {
    const statusStr =
      check.status === 'passed'
        ? colorize('[PASS]', COLORS.green, colorEnabled)
        : check.status === 'failed'
          ? colorize('[FAIL]', COLORS.red, colorEnabled)
          : '[SKIP]';

    const checkName = check.checkName;
    const duration = formatDuration(check.duration);

    // Calculate dot leaders to align durations
    const minWidth = 35;
    const contentLength = checkName.length + statusStr.replace(/\x1b\[[0-9;]*m/g, '').length;
    const dotsNeeded = Math.max(1, minWidth - contentLength);
    const dots = '.'.repeat(dotsNeeded);

    lines.push(`  ${statusStr} ${checkName} ${dots} ${duration}`);

    // Add details if present and check failed
    if (check.details && check.status === 'failed') {
      if (check.details.message) {
        lines.push(`         ${check.details.message}`);
      }
      if (check.details.missing && check.details.missing.length > 0) {
        for (const missing of check.details.missing) {
          lines.push(`         Missing: ${missing}`);
        }
      }
      if (check.details.issues && check.details.issues.length > 0) {
        for (const issue of check.details.issues) {
          lines.push(`         ${issue}`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format the retries section showing attempt history.
 * @param retries Array of retry information
 * @param colorEnabled Whether to apply colors
 * @returns Formatted retries string, or empty string if no retries
 */
export function formatRetries(retries: readonly RetryInfo[], colorEnabled: boolean): string {
  if (retries.length === 0) {
    return '';
  }

  const lines: string[] = ['RETRIES'];

  for (const retry of retries) {
    const { checkName, totalAttempts, succeededAtAttempt, attemptHistory } = retry;

    let summaryText = `${checkName}: ${totalAttempts} attempts`;
    if (succeededAtAttempt !== undefined) {
      summaryText += `, succeeded at attempt ${succeededAtAttempt}`;
    }
    lines.push(`  ${summaryText}`);

    // Format each attempt
    for (const attempt of attemptHistory) {
      const statusStr =
        attempt.status === 'passed'
          ? colorize('PASS', COLORS.green, colorEnabled)
          : colorize('FAIL', COLORS.red, colorEnabled);
      const duration = formatDuration(attempt.duration);

      let attemptLine = `    #${attempt.attemptNumber} ${statusStr} (${duration})`;
      if (attempt.error) {
        attemptLine += `: ${attempt.error}`;
      }
      lines.push(attemptLine);
    }
  }

  return lines.join('\n');
}

/**
 * Format the escalation section.
 * @param escalation Escalation information, or undefined
 * @param colorEnabled Whether to apply colors
 * @returns Formatted escalation string, or empty string if no escalation
 */
export function formatEscalation(escalation: EscalationInfo | undefined, colorEnabled: boolean): string {
  if (!escalation) {
    return '';
  }

  const lines: string[] = [colorize('ESCALATION', COLORS.yellow, colorEnabled)];
  lines.push(`  Reason:     ${escalation.reason}`);
  lines.push(`  Suggestion: ${escalation.suggestion}`);
  return lines.join('\n');
}

/**
 * Format the verdict line with summary counts and total duration.
 * @param report The enforcement report
 * @param colorEnabled Whether to apply colors
 * @returns Formatted verdict string
 */
export function formatVerdict(report: EnforcementReport, colorEnabled: boolean): string {
  const verdictStr =
    report.verdict === 'pass'
      ? colorize('PASS', COLORS.green, colorEnabled)
      : colorize('FAIL', COLORS.red, colorEnabled);

  const checkCount = report.checks.length;
  const checkWord = checkCount === 1 ? 'check' : 'checks';
  const retryCount = report.retries.length;
  const retryWord = retryCount === 1 ? 'retry' : 'retries';

  let summary = `${verdictStr} (${checkCount} ${checkWord}`;
  if (retryCount > 0) {
    summary += `, ${retryCount} ${retryWord}`;
  }
  summary += `, ${formatDuration(report.totalDuration)} total)`;

  return `VERDICT: ${summary}`;
}

export interface FormatReportOptions {
  color?: boolean;
}

/**
 * Format the complete enforcement report as a multi-section string.
 * This is the main formatting function that combines all sections.
 * @param report The enforcement report
 * @param options Formatting options (color, etc.)
 * @returns Complete formatted report string
 */
export function formatReport(report: EnforcementReport, options: FormatReportOptions = {}): string {
  const colorEnabled = options.color ?? false;
  const decorLine = colorize('━'.repeat(40), COLORS.dim, colorEnabled);

  const sections: string[] = [];

  // Top decoration
  sections.push(decorLine);
  sections.push(colorize('  VECTOR ENFORCEMENT REPORT', COLORS.bold, colorEnabled));
  sections.push(decorLine);
  sections.push('');

  // Header (blueprint + task)
  sections.push(formatHeader(report));
  sections.push('');

  // Checks section
  const checksSection = formatChecks(report.checks, colorEnabled);
  if (checksSection) {
    sections.push(checksSection);
    sections.push('');
  }

  // Retries section (only if retries exist)
  const retriesSection = formatRetries(report.retries, colorEnabled);
  if (retriesSection) {
    sections.push(retriesSection);
    sections.push('');
  }

  // Escalation section (only if escalation exists)
  const escalationSection = formatEscalation(report.escalation, colorEnabled);
  if (escalationSection) {
    sections.push(escalationSection);
    sections.push('');
  }

  // Verdict section
  sections.push(formatVerdict(report, colorEnabled));

  // Bottom decoration
  sections.push(decorLine);

  return sections.join('\n');
}

/**
 * Write the formatted report to terminal (stdout).
 * Automatically detects TTY and applies colors accordingly.
 * @param report The enforcement report to write
 */
export function writeToTerminal(report: EnforcementReport): void {
  const isTTY = process.stdout.isTTY === true;
  const formatted = formatReport(report, { color: isTTY });
  process.stdout.write(formatted + '\n');
}
