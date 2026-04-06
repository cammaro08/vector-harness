/**
 * Run Command
 *
 * Executes a Vector (collection of checks) and produces a report.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadProjectConfig, loadActiveConfig } from '../../config';
import { runVector } from '../../protocol/engine';
import { VectorName, ActiveConfig, VectorConfig } from '../../config/schema';
import { formatReport } from '../../../tools/terminalReporter';
import { writeReportToJSON } from '../../../tools/jsonLogger';
import { EnforcementReport } from '../../protocol/types';
import { S, colors, statusIcon } from '../ui/theme';

/**
 * Resolve check names for a vector, respecting active overrides.
 * Returns array of { name, definition } pairs.
 */
function resolveNamedChecks(
  config: VectorConfig,
  active: ActiveConfig | null,
  vector: VectorName
): Array<{ name: string; definition: typeof config.checks[string] }> {
  // Determine which check names to use
  const checkNames: string[] =
    active && vector in active.vectors
      ? active.vectors[vector] || []
      : config.vectors[vector]?.checks || [];

  return checkNames
    .filter((name) => config.checks[name] !== undefined)
    .map((name) => ({ name, definition: { ...config.checks[name] } }));
}

/**
 * Format duration in milliseconds to a human-readable string (e.g., "1.2s")
 */
function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Format a styled clack-style output for the enforcement report.
 *
 * Shows:
 * - Header with vector name
 * - Each check with status icon and duration
 * - Error details for failed checks
 * - Summary with pass/fail/skip counts
 */
export function formatStyledRun(report: EnforcementReport): string {
  const lines: string[] = [];

  // Header
  lines.push(S.start + '   ' + colors.brand(S.step + '  vector run ' + report.blueprintName));
  lines.push(S.middle);

  // Show each check
  for (const check of report.checks) {
    const icon = statusIcon(check.status);
    const duration = formatDuration(check.duration);
    // Line with active symbol and check name
    lines.push(`${S.middle}${colors.info(S.active)}  Running: ${colors.highlight(check.checkName)}`);
    // Line with status result
    lines.push(`${S.middle}  ${icon} ${check.checkName} ${check.status} (${duration})`);

    // Show error details if failed
    if (check.status === 'failed' && check.details?.message) {
      const errorMsg = check.details.message;
      const errorLines = errorMsg.split('\n');
      for (const errorLine of errorLines) {
        lines.push(`${S.middle}  ${S.middle}  ${colors.error(errorLine)}`);
      }
    }

    lines.push(S.middle);
  }

  // Summary line
  const passedCount = report.checks.filter((c) => c.status === 'passed').length;
  const failedCount = report.checks.filter((c) => c.status === 'failed').length;
  const skippedCount = report.checks.filter((c) => c.status === 'skipped').length;

  const summaryParts: string[] = [];
  if (passedCount > 0) {
    summaryParts.push(colors.success(`${passedCount} passed`));
  }
  if (failedCount > 0) {
    summaryParts.push(colors.error(`${failedCount} failed`));
  }
  if (skippedCount > 0) {
    summaryParts.push(colors.muted(`${skippedCount} skipped`));
  }

  const summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'no checks';
  lines.push(S.end + '  ' + report.blueprintName + ': ' + summary);

  return lines.join('\n');
}

/**
 * Detect git info from the current working directory.
 */
function getGitInfo(cwd: string): { branch: string; commit: string } {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();
    const commit = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf-8' }).trim();
    return { branch, commit };
  } catch {
    return { branch: 'unknown', commit: 'unknown' };
  }
}

/**
 * Run a Vector and produce a report.
 *
 * 1. Loads config + active overrides
 * 2. Resolves checks for the vector
 * 3. Executes the vector using the protocol engine
 * 4. Outputs terminal report
 * 5. Writes JSON report to .vector/reports/
 *
 * Returns 0 on success, 1 on failure.
 *
 * @param vectorName Vector name to run (required)
 * @param projectRoot Project root directory
 * @param flags Optional command-line flags
 */
export async function runCommand(
  vectorName: string,
  projectRoot: string,
  flags?: Record<string, string | boolean>
): Promise<number> {
  try {
    // Load configurations
    const config = loadProjectConfig(projectRoot);
    const active = loadActiveConfig(projectRoot);

    // Resolve named checks for this vector
    const namedChecks = resolveNamedChecks(
      config,
      active,
      vectorName as VectorName
    );

    // Log what we're about to do
    console.log(`\n[vector] Running vector '${vectorName}' with ${namedChecks.length} check(s):`);
    for (const { name, definition } of namedChecks) {
      const status = definition.enabled ? 'enabled' : 'disabled';
      console.log(`  - ${name}: "${definition.run}" (${status})`);
    }
    console.log('');

    if (namedChecks.length === 0) {
      console.warn(`[vector] No checks found for vector '${vectorName}'`);
      return 1; // Exit with error if no checks to run
    }

    // Filter to only enabled checks
    const enabledChecks = namedChecks.filter(({ definition }) => definition.enabled);
    if (enabledChecks.length === 0) {
      console.warn(`[vector] All checks for vector '${vectorName}' are disabled. Nothing to run.`);
      return 1; // Exit with error if all checks are disabled
    }

    if (enabledChecks.length < namedChecks.length) {
      const skipped = namedChecks.length - enabledChecks.length;
      console.log(`[vector] Skipping ${skipped} disabled check(s)\n`);
    }

    // Get environment info
    const git = getGitInfo(projectRoot);
    const environment = {
      cwd: projectRoot,
      gitBranch: git.branch,
      gitCommit: git.commit,
    };

    // Run the vector
    const report = await runVector({
      vectorName,
      checks: enabledChecks,
      maxRetries: config.defaults.maxRetries,
      timeout: config.defaults.timeout,
      environment,
    });

    // Output terminal report
    const terminalOutput = formatReport(report);
    console.log(terminalOutput);

    // Create reports directory
    const reportsDir = path.join(projectRoot, '.vector', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    // Write JSON report
    await writeReportToJSON(report, { outputDir: reportsDir });

    // Log final status
    if (report.verdict === 'pass') {
      console.log('\n[vector] All checks passed.\n');
    } else {
      console.log('\n[vector] Some checks failed. See report above.\n');
    }

    // Return appropriate exit code based on verdict
    return report.verdict === 'pass' ? 0 : 1;
  } catch (error) {
    console.error(`[vector] run: ${(error as Error).message}`);
    return 1;
  }
}
