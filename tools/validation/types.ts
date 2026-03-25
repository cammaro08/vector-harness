import { EnforcementReport } from '../enforcementReport';

/**
 * A validation scenario defines a realistic enforcement situation.
 * New features add new scenarios by exporting a ValidationScenario.
 */
export interface ValidationScenario {
  /** Unique scenario ID, e.g. 'all-pass', 'retry-then-pass' */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Tags for filtering (e.g. ['pass', 'retry', 'escalation', 'failure']) */
  readonly tags: readonly string[];
  /** Build the report for this scenario */
  buildReport(cwd: string): EnforcementReport;
}

/**
 * Output from running a scenario through all renderers.
 */
export interface ScenarioOutput {
  readonly scenarioId: string;
  readonly description: string;
  readonly terminal: string; // plain text (no ANSI)
  readonly terminalColored: string; // with ANSI codes
  readonly json: string; // pretty-printed JSON envelope
  readonly markdown: string; // GitHub markdown
  readonly verdict: 'pass' | 'fail';
}

/**
 * Full validation run result.
 */
export interface ValidationRunResult {
  readonly timestamp: string;
  readonly scenarios: readonly ScenarioOutput[];
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly tags: Record<string, number>;
  };
}
