import { EnforcementReport } from '../../../tools/enforcementReport';
import { writeToTerminal } from '../../../tools/terminalReporter';
import { writeReportToJSON } from '../../../tools/jsonLogger';
import { detectPRContext, renderMarkdown, postPRComment } from '../../../tools/ghPrCommenter';

/**
 * Configuration options for the reporter.
 */
export interface ReporterOptions {
  /** Working directory for relative path resolution */
  cwd: string;
  /** Git branch name (optional, for context) */
  gitBranch?: string;
  /** Git commit hash (optional, for context) */
  gitCommit?: string;
  /** Enable terminal output (default: true) */
  enableTerminal?: boolean;
  /** Enable JSON file output (default: true) */
  enableJSON?: boolean;
  /** Enable GitHub PR commenting (default: true, auto-skips if not in PR) */
  enablePRComment?: boolean;
  /** Directory for JSON output (default: 'docs' relative to cwd) */
  jsonOutputDir?: string;
  /** Dry-run mode for PR comments (don't actually post) (default: false) */
  dryRun?: boolean;
}

/**
 * Result from PR comment operation.
 */
export interface PRCommentResult {
  posted: boolean;
  error?: string;
}

/**
 * Result from the entire reporting operation.
 */
export interface ReportingResult {
  /** Whether terminal output succeeded */
  terminal: boolean;
  /** Path to JSON report file, or null if failed/disabled */
  jsonPath: string | null;
  /** PR comment result, or null if disabled/no PR context */
  prComment: PRCommentResult | null;
}

/**
 * Report enforcement results through multiple channels (terminal, JSON, PR).
 * Each renderer is independent — failure in one does not block the others.
 *
 * @param report The enforcement report to disseminate
 * @param options Configuration for which renderers to use and how
 * @returns Result object indicating success/failure of each channel
 */
export async function reportEnforcementResults(
  report: EnforcementReport,
  options: ReporterOptions
): Promise<ReportingResult> {
  // Apply defaults
  const enableTerminal = options.enableTerminal !== false; // default: true
  const enableJSON = options.enableJSON !== false; // default: true
  const enablePRComment = options.enablePRComment !== false; // default: true
  const jsonOutputDir = options.jsonOutputDir || 'docs';
  const dryRun = options.dryRun === true; // default: false

  const result: ReportingResult = {
    terminal: false,
    jsonPath: null,
    prComment: null,
  };

  // 1. Terminal Reporter (non-blocking, try-catch)
  if (enableTerminal) {
    try {
      writeToTerminal(report);
      result.terminal = true;
    } catch (err) {
      // Silently fail, continue to other renderers
      result.terminal = false;
    }
  }

  // 2. JSON Logger (non-blocking, try-catch)
  if (enableJSON) {
    try {
      const jsonResult = await writeReportToJSON(report, {
        outputDir: jsonOutputDir,
      });

      if (jsonResult.success) {
        result.jsonPath = jsonResult.filePath;
      } else {
        result.jsonPath = null;
      }
    } catch (err) {
      // Silently fail, continue to other renderers
      result.jsonPath = null;
    }
  }

  // 3. PR Commenter (non-blocking, try-catch)
  if (enablePRComment) {
    try {
      const prContext = detectPRContext();

      if (prContext) {
        // We're in a PR context, render and post
        const markdown = renderMarkdown(report);
        const postResult = await postPRComment({
          prNumber: prContext.prNumber,
          body: markdown,
          dryRun,
        });

        result.prComment = {
          posted: postResult.posted,
          error: postResult.error,
        };
      }
      // If not in PR context, prComment remains null
    } catch (err) {
      // Silently fail
      result.prComment = {
        posted: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return result;
}
