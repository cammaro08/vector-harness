/**
 * Check Add Command
 *
 * Adds a new check to the Vector configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { loadProjectConfig } from '../../config';
import { VectorName } from '../../config/schema';

/**
 * Validate check name format and length.
 * Check names should be lowercase alphanumeric with hyphens only, 1-64 chars.
 */
export function validateCheckName(name: string): boolean {
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
export function validateRunCommand(command: string): boolean {
  const MAX_COMMAND_LENGTH = 4096;
  if (!command || command.trim().length === 0 || command.length > MAX_COMMAND_LENGTH) {
    return false;
  }
  return true;
}

/**
 * Add a new check to the configuration.
 *
 * Interactive mode (TTY, no --name/--run):
 * - Prompts for check name
 * - Prompts for run command
 * - Prompts for vector assignment (multiselect)
 *
 * Non-interactive mode (--name and --run flags provided, or non-TTY):
 * - Adds check to config with provided flags
 * - Requires both --name and --run flags
 *
 * Flags:
 * - --name <name>: check name (required in non-interactive, optional in interactive)
 * - --run <command>: shell command (required in non-interactive, optional in interactive)
 * - --force: overwrite check if it already exists (optional)
 *
 * Returns 0 on success, 1 on failure.
 */
export async function checkAddCommand(
  flags: Record<string, string | boolean>,
  projectRoot: string
): Promise<number> {
  try {
    const { isInteractive } = await import('../ui/theme');
    const { intro, text, multiselect, outro, isCancel } = await import(
      '@clack/prompts'
    );

    let checkName = flags.name as string | undefined;
    let runCommand = flags.run as string | undefined;
    const force = flags.force === true;

    // Determine if we should use interactive mode
    const interactive = isInteractive() && (!checkName || !runCommand);

    if (interactive) {
      intro('[vector] Check Add');

      // Prompt for check name if not provided
      if (!checkName) {
        while (true) {
          const nameInput = await text({
            message: 'Check name:',
            placeholder: 'e.g., lint-staged',
            validate: (value) =>
              value && validateCheckName(value) ? undefined : 'Invalid name format',
          });

          if (isCancel(nameInput)) {
            outro('Cancelled');
            return 1;
          }

          checkName = nameInput;
          if (validateCheckName(checkName)) {
            break;
          }
        }
      }

      // Prompt for run command if not provided
      if (!runCommand) {
        while (true) {
          const cmdInput = await text({
            message: 'Shell command to run:',
            placeholder: 'e.g., npx lint-staged',
            validate: (value) =>
              value && validateRunCommand(value) ? undefined : 'Invalid command',
          });

          if (isCancel(cmdInput)) {
            outro('Cancelled');
            return 1;
          }

          runCommand = cmdInput;
          if (validateRunCommand(runCommand)) {
            break;
          }
        }
      }

      // Load config to get available vectors
      const config = loadProjectConfig(projectRoot);
      const availableVectors = Object.keys(config.vectors) as VectorName[];

      // Prompt for vector assignment
      const selectedVectors = await multiselect({
        message: 'Add to which vectors?',
        options: availableVectors.map((v) => ({
          label: v,
          value: v,
        })),
      });

      if (isCancel(selectedVectors)) {
        outro('Cancelled');
        return 1;
      }

      // Add check to config (both are guaranteed set by this point)
      config.checks[checkName as string] = {
        run: runCommand as string,
        expect: 'exit-0',
        enabled: true,
      };

      // Add check to selected vectors
      for (const vectorName of selectedVectors as VectorName[]) {
        if (config.vectors[vectorName]) {
          if (!config.vectors[vectorName]!.checks.includes(checkName as string)) {
            config.vectors[vectorName]!.checks.push(checkName as string);
          }
        }
      }

      // Write back to config.yaml
      const configPath = path.join(projectRoot, '.vector', 'config.yaml');
      const yaml_str = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
      });
      fs.writeFileSync(configPath, yaml_str, 'utf-8');

      outro(`Check added! Run 'vector run ${selectedVectors[0] || 'v1'}' to test it.`);
      return 0;
    } else {
      // Non-interactive mode: require both flags
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
    }
  } catch (error) {
    console.error(`[vector] check add: ${(error as Error).message}`);
    return 1;
  }
}
