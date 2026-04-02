import {
  formatReport as v1FormatReport,
  writeToTerminal as v1WriteToTerminal,
} from '../../tools/terminalReporter';
import { EnforcementReport } from '../protocol/types';

export interface TerminalRendererOptions {
  color?: boolean;
}

/**
 * Render an EnforcementReport as formatted terminal string.
 * Thin wrapper around v1 formatReport.
 */
export function render(report: EnforcementReport, options?: TerminalRendererOptions): string {
  return v1FormatReport(report, {
    color: options?.color ?? false,
  });
}

/**
 * Write an EnforcementReport to terminal (stdout).
 * Thin wrapper around v1 writeToTerminal.
 * Automatically detects TTY for color support.
 */
export function write(report: EnforcementReport): void {
  v1WriteToTerminal(report);
}
