/**
 * Claude Code Adapter
 *
 * Wires Vector into Claude Code hooks.
 * Reads project config, calls the protocol engine, and formats output for Claude Code.
 */

import * as path from 'path';
import { execSync } from 'child_process';
import { VectorName } from '../config/schema';
import { loadProjectConfig, loadActiveConfig, resolveNamedChecksForVector } from '../config/loader';
import { runVector } from '../protocol/engine';
import { EnforcementReport, EnvironmentInfo } from '../protocol/types';
import { formatReport } from '../../tools/terminalReporter';

export interface AdapterOptions {
  projectRoot: string;
  vectorName: VectorName;
}

export interface AdapterResult {
  report: EnforcementReport;
  exitCode: number;
  output: string; // formatted terminal output for Claude Code to consume
}

export interface HookConfig {
  hooks: {
    Stop?: Array<{ type: string; command: string }>;
    PostToolUse?: Array<{ type: string; command: string; matcher: string }>;
  };
}

/**
 * Run a vector check through the adapter.
 * This is the entry point Claude Code hooks call.
 *
 * @param options Configuration with project root and vector name
 * @returns Result with report, exit code, and formatted output
 */
export async function runAdapter(options: AdapterOptions): Promise<AdapterResult> {
  const { projectRoot, vectorName } = options;

  // Load project config
  const config = loadProjectConfig(projectRoot);

  // Load active config (optional)
  const activeConfig = loadActiveConfig(projectRoot);

  // Resolve checks for the vector (respects active config overrides)
  // This returns Array<{ name: string; definition: CheckDefinition }>
  const checks = resolveNamedChecksForVector(config, activeConfig, vectorName);

  // Detect git info from the current working directory
  let gitBranch = 'unknown';
  let gitCommit = 'unknown';
  try {
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectRoot,
      encoding: 'utf-8',
    }).trim();
    gitCommit = execSync('git rev-parse --short HEAD', {
      cwd: projectRoot,
      encoding: 'utf-8',
    }).trim();
  } catch {
    // Git detection failed; use defaults
  }

  // Build environment info
  const environment: EnvironmentInfo = {
    cwd: projectRoot,
    gitBranch,
    gitCommit,
  };

  // Run the vector engine
  const report = await runVector({
    vectorName,
    checks,
    maxRetries: config.defaults.maxRetries,
    timeout: config.defaults.timeout,
    environment,
  });

  // Format output for terminal
  const output = formatReport(report, { color: false });

  // Determine exit code: 0 if all checks passed, 1 otherwise
  const exitCode = report.checks.every((check) => check.status === 'passed') ? 0 : 1;

  return {
    report,
    exitCode,
    output,
  };
}

/**
 * Generate Claude Code hook configuration.
 * Returns the full hook config that `vector init` should write to .claude/settings.local.json.
 *
 * @returns Hook configuration object
 */
export function generateHookConfig(): HookConfig {
  return {
    hooks: {
      Stop: [
        {
          type: 'command',
          command: 'npx vector run v1',
        },
      ],
    },
  };
}
