import {
  renderMarkdown as v1RenderMarkdown,
  postPRComment as v1PostPRComment,
  detectPRContext as v1DetectPRContext,
} from '../../tools/ghPrCommenter';
import { EnforcementReport } from '../protocol/types';

export interface PRCommentResult {
  posted: boolean;
  markdown: string;
  error?: string;
}

export interface PRContext {
  prNumber: number;
  branch: string;
}

export interface PostOptions {
  dryRun?: boolean;
}

/**
 * Render an EnforcementReport as GitHub markdown.
 * Thin wrapper around v1 renderMarkdown.
 */
export function render(report: EnforcementReport): string {
  return v1RenderMarkdown(report);
}

/**
 * Post a report to a GitHub PR as a comment.
 * Thin wrapper around v1 postPRComment.
 * If dryRun is true, returns markdown without posting.
 * If not in a PR context and not dryRun, returns error.
 */
export async function post(
  report: EnforcementReport,
  options?: PostOptions
): Promise<PRCommentResult> {
  const markdown = render(report);
  const dryRun = options?.dryRun ?? false;

  // For dryRun, return immediately without checking PR context
  if (dryRun) {
    return {
      posted: false,
      markdown,
    };
  }

  const prContext = detectPR();
  if (!prContext) {
    return {
      posted: false,
      markdown,
      error: 'Not in a PR context',
    };
  }

  const result = await v1PostPRComment({
    prNumber: prContext.prNumber,
    body: markdown,
    dryRun: false,
  });

  return {
    posted: result.posted,
    markdown: result.markdown,
    error: result.error,
  };
}

/**
 * Detect if we're in a GitHub PR context.
 * Thin wrapper around v1 detectPRContext.
 */
export function detectPR(): PRContext | null {
  const context = v1DetectPRContext();
  return context ? { prNumber: context.prNumber, branch: context.branch } : null;
}
