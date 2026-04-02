/**
 * Run Command
 *
 * Executes a Vector (collection of checks) and produces a report.
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadProjectConfig, loadActiveConfig, resolveChecksForVector } from '../../config';
import { runVector } from '../../protocol/engine';
import { VectorName } from '../../config/schema';
import { formatReport } from '../../../tools/terminalReporter';
import { writeReportToJSON } from '../../../tools/jsonLogger';

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

    // Resolve checks for this vector
    const checks = resolveChecksForVector(
      config,
      active,
      vectorName as VectorName
    );

    if (checks.length === 0) {
      console.warn(`No checks found for vector '${vectorName}'`);
    }

    // Get environment info
    const environment = {
      cwd: projectRoot,
      gitBranch: 'main', // TODO: detect from git
      gitCommit: 'unknown', // TODO: detect from git
    };

    // Run the vector
    const report = await runVector({
      vectorName,
      checks: checks.map((definition, index) => {
        // Get the check name from config
        const checkName = Object.keys(config.checks).find(
          (name) => config.checks[name] === definition
        );
        return {
          name: checkName || `check-${index}`,
          definition,
        };
      }),
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

    // Return appropriate exit code based on verdict
    return report.verdict === 'pass' ? 0 : 1;
  } catch (error) {
    console.error(`Failed to run vector: ${(error as Error).message}`);
    return 1;
  }
}
