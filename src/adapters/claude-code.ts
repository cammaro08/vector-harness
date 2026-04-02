/**
 * Claude Code Adapter
 *
 * Wires Vector into Claude Code hooks.
 * Reads project config, calls the protocol engine, and formats output for Claude Code.
 */

import * as path from 'path';
import { VectorName } from '../config/schema';
import { loadProjectConfig, loadActiveConfig, resolveChecksForVector } from '../config/loader';
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

  // Resolve checks for the vector
  const checkDefinitions = resolveChecksForVector(config, activeConfig, vectorName);

  // Convert check definitions to engine format: name -> definition
  const checks = checkDefinitions.map((definition, index) => {
    // Try to find the check name from the vector definition
    const vectorDef = config.vectors[vectorName];
    const checkName = vectorDef && vectorDef.checks[index] ? vectorDef.checks[index] : `check-${index}`;
    return { name: checkName, definition };
  });

  // Build environment info
  const environment: EnvironmentInfo = {
    cwd: projectRoot,
    gitBranch: 'unknown',
    gitCommit: 'unknown',
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
