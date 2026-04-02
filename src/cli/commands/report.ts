/**
 * Report Command
 *
 * Retrieves and displays the latest enforcement report.
 */

import * as fs from 'fs';
import * as path from 'path';
import { readReportFromJSON } from '../../../tools/jsonLogger';
import {
  formatReport,
  writeToTerminal,
} from '../../../tools/terminalReporter';
import { renderMarkdown } from '../../../tools/ghPrCommenter';

/**
 * Display the latest report.
 *
 * Finds the most recent report in .vector/reports/ and displays it
 * in the requested format (terminal, json, or markdown).
 *
 * Flags:
 * - --format <terminal|json|markdown>: output format (default: terminal)
 *
 * Returns 0 on success, 1 if no reports found or error.
 */
export async function reportCommand(
  flags: Record<string, string | boolean>,
  projectRoot: string
): Promise<number> {
  try {
    const reportsDir = path.join(projectRoot, '.vector', 'reports');

    // Find the latest report file
    let reportPath: string | null = null;
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      // Look for enforcement-report-*.json files, sorted by name (timestamp)
      const reportFiles = files
        .filter((f) => f.startsWith('enforcement-report-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Reverse to get latest first (lexicographically, timestamps sort correctly)

      if (reportFiles.length > 0) {
        reportPath = path.join(reportsDir, reportFiles[0]);
      }
    }

    // Check if report was found
    if (!reportPath || !fs.existsSync(reportPath)) {
      console.error('[vector] report: no reports found');
      return 1;
    }

    // Read the report
    const readResult = await readReportFromJSON(reportPath);

    if (!readResult.success) {
      console.error(`[vector] report: failed to read report: ${readResult.error}`);
      return 1;
    }

    const report = readResult.report;

    // Format and output based on format flag
    const format = (flags.format as string) || 'terminal';

    switch (format) {
      case 'json': {
        console.log(JSON.stringify(report, null, 2));
        return 0;
      }

      case 'markdown': {
        const markdown = renderMarkdown(report);
        console.log(markdown);
        return 0;
      }

      case 'terminal':
      default: {
        const output = formatReport(report);
        console.log(output);
        return 0;
      }
    }
  } catch (error) {
    console.error(`[vector] report: ${(error as Error).message}`);
    return 1;
  }
}
