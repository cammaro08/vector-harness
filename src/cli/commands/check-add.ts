/**
 * Check Add Command
 *
 * Adds a new check to the Vector configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { loadProjectConfig } from '../../config';

/**
 * Validate check name format and length.
 * Check names should be lowercase alphanumeric with hyphens only, 1-64 chars.
 */
function validateCheckName(name: string): boolean {
  const MAX_NAME_LENGTH = 64;
  if (!name || name.length > MAX_NAME_LENGTH) {
    return false;
  }
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

/**
 * Validate run command.
 * Run commands must not be empty or excessively long.
 */
function validateRunCommand(command: string): boolean {
  const MAX_COMMAND_LENGTH = 4096;
  if (!command || command.trim().length === 0 || command.length > MAX_COMMAND_LENGTH) {
    return false;
  }
  return true;
}

/**
 * Add a new check to the configuration.
 *
 * Reads config.yaml, adds the check, and writes back.
 *
 * Flags:
 * - --name <name>: check name (required, lowercase alphanumeric + hyphens)
 * - --run <command>: shell command to execute (required)
 * - --force: overwrite check if it already exists (optional)
 *
 * Returns 0 on success, 1 on failure.
 */
export async function checkAddCommand(
  flags: Record<string, string | boolean>,
  projectRoot: string
): Promise<number> {
  try {
    const checkName = flags.name as string;
    const runCommand = flags.run as string;
    const force = flags.force === true;

    if (!checkName) {
      console.error('[vector] check add: --name flag is required');
      return 1;
    }

    if (!runCommand) {
      console.error('[vector] check add: --run flag is required');
      return 1;
    }

    // Validate check name format
    if (!validateCheckName(checkName)) {
      console.error(
        `[vector] check add: check name '${checkName}' is invalid. Use lowercase alphanumeric characters and hyphens only (1-64 chars).`
      );
      return 1;
    }

    // Validate run command
    if (!validateRunCommand(runCommand)) {
      console.error(
        `[vector] check add: run command is invalid or too long (max 4096 chars).`
      );
      return 1;
    }

    // Load current config
    const config = loadProjectConfig(projectRoot);

    // Check if check already exists
    if (config.checks[checkName]) {
      if (!force) {
        console.error(
          `[vector] check add: check '${checkName}' already exists. Use --force to overwrite.`
        );
        return 1;
      }
      console.log(`[vector] Overwriting existing check '${checkName}'`);
    }

    // Add the new check
    config.checks[checkName] = {
      run: runCommand,
      expect: 'exit-0',
      enabled: true,
    };

    // Write back to config.yaml
    const configPath = path.join(projectRoot, '.vector', 'config.yaml');
    const yaml_str = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
    });
    fs.writeFileSync(configPath, yaml_str, 'utf-8');

    console.log(`✓ Added check '${checkName}'`);
    return 0;
  } catch (error) {
    console.error(`[vector] check add: ${(error as Error).message}`);
    return 1;
  }
}
