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
 * Add a new check to the configuration.
 *
 * Reads config.yaml, adds the check, and writes back.
 *
 * Flags:
 * - --name <name>: check name
 * - --run <command>: shell command to execute
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

    if (!checkName) {
      console.error('Error: --name flag is required');
      return 1;
    }

    if (!runCommand) {
      console.error('Error: --run flag is required');
      return 1;
    }

    // Load current config
    const config = loadProjectConfig(projectRoot);

    // Check if check already exists
    if (config.checks[checkName]) {
      console.error(`Error: check '${checkName}' already exists`);
      return 1;
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
    console.error(`Failed to add check: ${(error as Error).message}`);
    return 1;
  }
}
