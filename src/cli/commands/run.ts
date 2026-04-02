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
 */
export async function runCommand(
  vectorName: string,
  projectRoot: string
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
      return 0;
    }

    // Filter to only enabled checks
    const enabledChecks = namedChecks.filter(({ definition }) => definition.enabled);
    if (enabledChecks.length === 0) {
      console.warn(`[vector] All checks for vector '${vectorName}' are disabled`);
      return 0;
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
    console.error(`[vector] Failed to run vector: ${(error as Error).message}`);
    return 1;
  }
}
