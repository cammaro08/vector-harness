import {
  green,
  red,
  yellow,
  cyan,
  bold,
  dim,
} from 'picocolors';

// Symbol constants
export const S = {
  start: '┌',
  middle: '│',
  end: '└',
  step: '◇',
  active: '●',
  prompt: '◆',
  success: '✓',
  failure: '✗',
  skipped: '○',
  bar: '─',
  corner: '╮',
} as const;

// Semantic color palette
export const colors = {
  success: (s: string) => green(s),
  error: (s: string) => red(s),
  warning: (s: string) => yellow(s),
  info: (s: string) => cyan(s),
  muted: (s: string) => dim(s),
  highlight: (s: string) => bold(s),
  brand: (s: string) => cyan(bold(s)),
} as const;

/**
 * Truncates a string to a maximum length, adding '…' if truncated
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  // Reserve 1 character for the ellipsis
  const truncateAt = Math.max(0, maxLen - 1);
  return str.slice(0, truncateAt) + '…';
}

/**
 * Right-pads a string to a specified length
 */
export function pad(
  str: string,
  len: number,
  char: string = ' '
): string {
  if (str.length >= len) {
    return str;
  }
  return str + char.repeat(len - str.length);
}

/**
 * Indents a string with vertical bars
 */
export function indent(str: string, level: number = 1): string {
  if (level <= 0 || !str) {
    return str;
  }
  const indentStr = (S.middle + '  ').repeat(level);
  return str
    .split('\n')
    .map((line, index) => (index === 0 ? indentStr + line : indentStr + line))
    .join('\n');
}

/**
 * Creates a separator line with optional label
 */
export function separator(label?: string, width: number = 40): string {
  const barChar = S.bar;
  if (!label) {
    return barChar.repeat(width);
  }
  const labelWidth = label.length;
  const totalBars = width - labelWidth - 2; // 2 for the spaces around label
  const leftBars = Math.floor(totalBars / 2);
  const rightBars = totalBars - leftBars;
  return (
    barChar.repeat(leftBars) +
    ' ' +
    label +
    ' ' +
    barChar.repeat(rightBars)
  );
}

/**
 * Returns a colored and symbolic status indicator
 */
export function statusIcon(
  status: 'passed' | 'failed' | 'skipped' | 'running'
): string {
  switch (status) {
    case 'passed':
      return colors.success(S.success);
    case 'failed':
      return colors.error(S.failure);
    case 'skipped':
      return colors.muted(S.skipped);
    case 'running':
      return colors.info(S.active);
    default:
      const _exhaustive: never = status;
      return _exhaustive;
  }
}

/**
 * Checks if stdout is a TTY (interactive terminal)
 */
export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY);
}
