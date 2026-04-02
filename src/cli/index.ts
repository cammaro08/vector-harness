/**
 * Vector CLI Entry Point
 *
 * Provides argument parser and main() dispatch function.
 */

import { initCommand } from './commands/init';
import { runCommand } from './commands/run';
import { activateCommand } from './commands/activate';
import { reportCommand } from './commands/report';
import { checkAddCommand } from './commands/check-add';

const HELP_TEXT = `Vector v2 CLI - Configuration-driven check and enforcement system

Usage:
  vector <command> [options]

Commands:
  init                          Initialize Vector in the current project
  run <vector-name>             Run checks for a specific vector (v1-v5)
  activate [options]            Toggle specific checks for the current task
  report [options]              Display the latest enforcement report
  check add [options]           Add a new check to the configuration
  help                          Show this help message

Options:
  --help, -h                    Show help for a specific command

Examples:
  vector init
  vector run v1
  vector check add --name lint --run "npm run lint"
  vector activate --check test-pass --on --vector v2
  vector report --format json
  vector run v1 --help
`;

function printHelp(commandName?: string): void {
  if (commandName) {
    // Print help for a specific command
    switch (commandName) {
      case 'init':
        console.log(`Vector Init

Initialize Vector configuration in the current project.

Usage:
  vector init

This creates a .vector/ directory with:
  - config.yaml: Project-wide check registry and vector definitions
  - active.yaml: Task-level check overrides (auto-created on demand)
  - reports/: Directory for JSON report output
`);
        break;

      case 'run':
        console.log(`Vector Run

Execute checks for a specific vector.

Usage:
  vector run <vector-name>

Arguments:
  vector-name     Name of the vector to run (v1, v2, v3, v4, or v5)

Returns exit code 0 if all checks pass, 1 if any fail.
`);
        break;

      case 'check':
        console.log(`Vector Check

Manage checks in the configuration.

Usage:
  vector check add [options]

Subcommands:
  add               Add a new check to the configuration

Options:
  --name <name>     Check name (lowercase alphanumeric + hyphens, 1-64 chars) [required]
  --run <command>   Shell command to execute (max 4096 chars) [required]
  --force           Overwrite check if it already exists
`);
        break;

      case 'activate':
        console.log(`Vector Activate

Toggle specific checks for the current task.

Usage:
  vector activate [options]

Options:
  --check <name>    Name of the check to toggle
  --on              Enable the check for this task
  --off             Disable the check for this task
  --vector <name>   Vector to apply the override to (v1-v5)

Examples:
  vector activate --check lint --on --vector v2
  vector activate --check test --off --vector v1
`);
        break;

      case 'report':
        console.log(`Vector Report

Display the latest enforcement report.

Usage:
  vector report [options]

Options:
  --format <type>   Report format: terminal, json, or markdown (default: terminal)
  --json            Shorthand for --format json
  --markdown        Shorthand for --format markdown
`);
        break;

      default:
        console.log(HELP_TEXT);
        break;
    }
  } else {
    console.log(HELP_TEXT);
  }
}

export interface ParsedArgs {
  command: string; // 'init' | 'run' | 'activate' | 'report' | 'check'
  subcommand?: string; // e.g., 'add' for 'vector check add'
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parse command line arguments.
 *
 * Returns a ParsedArgs object with:
 * - command: the first argument after 'vector' (or 'node', 'ts-node')
 * - subcommand: optional second command (e.g., 'add' in 'check add')
 * - positional: remaining non-flag arguments
 * - flags: key-value pairs for --flag and --flag=value forms
 *
 * @param argv process.argv style array
 * @returns ParsedArgs object
 */
export function parseArgs(argv: string[]): ParsedArgs {
  // Skip first two elements (node/ts-node and script path)
  const args = argv.slice(2);

  if (args.length === 0) {
    return {
      command: '',
      positional: [],
      flags: {},
    };
  }

  const command = args[0];
  let subcommand: string | undefined;
  let startIndex = 1;

  // Check if next arg is a subcommand (doesn't start with --)
  if (args.length > 1 && !args[1].startsWith('--')) {
    // Check if this could be a vector name (v1-v5) vs a subcommand
    // For 'check add', 'add' is a subcommand
    // For 'run v2', 'v2' is a positional
    // We'll treat it as subcommand if command is 'check'
    if (command === 'check') {
      subcommand = args[1];
      startIndex = 2;
    }
  }

  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  // Process remaining arguments
  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      // Handle flags
      const withoutDashes = arg.substring(2);

      if (withoutDashes.includes('=')) {
        // --flag=value form
        const [key, value] = withoutDashes.split('=', 2);
        flags[key] = value;
      } else {
        // --flag form (boolean or next arg is value)
        const nextArg = args[i + 1];

        // Check if next arg is available and looks like a value (not a flag)
        if (nextArg && !nextArg.startsWith('--')) {
          // This is a flag with a value
          flags[withoutDashes] = nextArg;
          i++; // Skip next arg
        } else {
          // This is a boolean flag
          flags[withoutDashes] = true;
        }
      }
    } else {
      // Positional argument
      positional.push(arg);
    }
  }

  return {
    command,
    subcommand,
    positional,
    flags,
  };
}

/**
 * Main CLI entry point.
 *
 * Parses arguments and dispatches to appropriate command handler.
 * Returns exit code (0 for success, 1 for failure).
 *
 * @param argv optional process.argv (defaults to actual process.argv)
 * @returns exit code
 */
export async function main(argv?: string[]): Promise<number> {
  const args = argv || process.argv;
  const projectRoot = process.cwd();

  const parsed = parseArgs(args);

  // Check for help flags or help command
  if (parsed.flags.help || parsed.flags.h) {
    printHelp(parsed.command);
    return 0;
  }

  // Check for empty command
  if (!parsed.command) {
    console.error('[vector]: no command specified');
    printHelp();
    return 1;
  }

  try {
    switch (parsed.command) {
      case 'help':
        printHelp(parsed.positional[0]);
        return 0;

      case 'init':
        return await initCommand(projectRoot);

      case 'run': {
        if (parsed.positional.length === 0) {
          console.error('[vector] run: missing vector name');
          console.error('Usage: vector run <vector-name>');
          return 1;
        }
        const vectorName = parsed.positional[0];
        return await runCommand(vectorName, projectRoot);
      }

      case 'activate':
        return await activateCommand(parsed.flags, projectRoot);

      case 'report':
        return await reportCommand(parsed.flags, projectRoot);

      case 'check': {
        if (parsed.subcommand === 'add') {
          return await checkAddCommand(parsed.flags, projectRoot);
        }
        console.error(`[vector] check: unknown subcommand '${parsed.subcommand}'`);
        console.error('Usage: vector check add --name <name> --run <command>');
        return 1;
      }

      default:
        console.error(`[vector]: unknown command '${parsed.command}'`);
        console.error(
          'Usage: vector <init|run|activate|report|check> [options]'
        );
        return 1;
    }
  } catch (error) {
    console.error(`[vector]: ${(error as Error).message}`);
    return 1;
  }
}
