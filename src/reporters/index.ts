import * as terminal from './terminal';
import * as json from './json';
import * as prComment from './pr-comment';
import { EnforcementReport } from '../protocol/types';

export type ReporterType = 'terminal' | 'json' | 'markdown';

export interface ReporterOptions {
  type: ReporterType;
  outputDir?: string; // for json reporter
  color?: boolean; // for terminal reporter
  dryRun?: boolean; // for pr-comment reporter
}

export interface WriteResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Get the formatted output for a report using the specified reporter.
 * Returns the formatted string regardless of type (JSON, markdown, or terminal).
 */
export function formatWithReporter(report: EnforcementReport, options: ReporterOptions): string {
  switch (options.type) {
    case 'terminal':
      return terminal.render(report, { color: options.color });
    case 'json':
      return JSON.stringify(
        {
          _meta: {
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            generator: 'vector-enforcer',
          },
          report,
        },
        null,
        2
      );
    case 'markdown':
      return prComment.render(report);
    default:
      const exhaustiveCheck: never = options.type;
      return exhaustiveCheck;
  }
}

/**
 * Write a report using the specified reporter.
 * Terminal → stdout, JSON → file, Markdown → returns string (for PR comment)
 */
export async function writeWithReporter(
  report: EnforcementReport,
  options: ReporterOptions
): Promise<WriteResult> {
  try {
    switch (options.type) {
      case 'terminal': {
        terminal.write(report);
        return { success: true };
      }
      case 'json': {
        const result = await json.writeJSON(report, options.outputDir);
        if (result.success) {
          return { success: true };
        }
        return { success: false, error: result.error };
      }
      case 'markdown': {
        const result = await prComment.post(report, { dryRun: options.dryRun });
        if (result.posted || options.dryRun) {
          return { success: true, output: result.markdown };
        }
        return { success: false, error: result.error };
      }
      default:
        const exhaustiveCheck: never = options.type;
        return exhaustiveCheck;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

// Re-export reporter modules for direct access
export * as terminal from './terminal';
export * as json from './json';
export * as prComment from './pr-comment';
