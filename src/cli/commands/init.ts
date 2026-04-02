/**
 * Init Command
 *
 * Initializes a Vector project by creating .vector/config.yaml
 * and updating .claude/settings.local.json with hook configuration.
 *
 * Supports both interactive (TTY) and non-interactive (--yes/-y) modes.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  intro,
  text,
  select,
  confirm,
  outro,
  isCancel,
} from '@clack/prompts';
import { showBanner } from '../banner';
import { isInteractive } from '../ui/theme';
import { generateDefaultConfigYaml } from '../../config';
import { DEFAULT_CONFIG } from '../../config/defaults';

// Default hook configuration for Claude Code integration
const DEFAULT_HOOK_COMMAND = 'npx vector run v1';
const HOOK_TYPE = 'command';

/**
 * Create an empty config (no checks, just vector structure).
 */
function generateEmptyConfigYaml(vectorName: string): string {
  const config: any = {
    version: '2',
    checks: {},
    vectors: {
      [vectorName]: {
        trigger: `${vectorName} checks`,
        checks: [],
      },
    },
    defaults: {
      maxRetries: 3,
      timeout: 30000,
    },
  };
  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
  });
}

/**
 * Create a config with default checks.
 */
function generateConfigWithDefaults(vectorName: string): string {
  const config = { ...DEFAULT_CONFIG };
  // Replace v1 with user's vector name
  if (config.vectors.v1) {
    config.vectors[vectorName] = config.vectors.v1;
    delete config.vectors.v1;
  }
  return yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
  });
}

/**
 * Initialize a Vector project.
 *
 * Interactive mode (TTY):
 * - Prompts for vector name, default checks, and hook setup
 * - Shows banner and progress with @clack/prompts
 *
 * Non-interactive mode (--yes/-y or non-TTY):
 * - Creates everything with defaults silently
 *
 * Creates:
 * - .vector/config.yaml (if not exists)
 * - .claude/settings.local.json with Stop hook (if user accepts)
 *
 * Returns 0 on success, 1 on failure.
 */
export async function initCommand(
  flags: Record<string, string | boolean>,
  projectRoot: string
): Promise<number> {
  try {
    const isNonInteractive =
      flags.yes === true || flags.y === true || !isInteractive();

    if (isNonInteractive) {
      // Non-interactive mode: use defaults
      return await nonInteractiveInit(projectRoot);
    } else {
      // Interactive mode: prompt user
      return await interactiveInit(projectRoot);
    }
  } catch (error) {
    console.error(`[vector] init: ${(error as Error).message}`);
    return 1;
  }
}

/**
 * Non-interactive initialization with default settings.
 */
async function nonInteractiveInit(projectRoot: string): Promise<number> {
  const vectorDir = path.join(projectRoot, '.vector');
  const configPath = path.join(vectorDir, 'config.yaml');
  const claudeDir = path.join(projectRoot, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.local.json');

  // Create .vector directory
  fs.mkdirSync(vectorDir, { recursive: true });

  // Create config.yaml if it doesn't exist
  if (!fs.existsSync(configPath)) {
    const defaultYaml = generateDefaultConfigYaml();
    fs.writeFileSync(configPath, defaultYaml, 'utf-8');
  }

  // Create .claude directory if needed
  fs.mkdirSync(claudeDir, { recursive: true });

  // Create or merge settings.local.json with hook config
  let settings: any = {};

  if (fs.existsSync(settingsPath)) {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    try {
      settings = JSON.parse(content);
    } catch {
      settings = {};
    }
  }

  // Ensure hooks structure exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Merge Stop hook instead of overwriting
  const vectorHook = {
    type: HOOK_TYPE,
    command: DEFAULT_HOOK_COMMAND,
  };

  if (Array.isArray(settings.hooks.Stop)) {
    // Check if vector hook already exists
    const alreadyExists = settings.hooks.Stop.some(
      (hook: any) => hook.command === DEFAULT_HOOK_COMMAND
    );
    if (!alreadyExists) {
      settings.hooks.Stop.push(vectorHook);
    }
  } else {
    // Create Stop hook with vector command
    settings.hooks.Stop = [vectorHook];
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

  return 0;
}

/**
 * Interactive initialization with user prompts.
 */
async function interactiveInit(projectRoot: string): Promise<number> {
  showBanner();
  intro('Vector project initialization');

  // Prompt for vector name
  const vectorName = (await text({
    message: 'What would you like to name your first vector?',
    placeholder: 'v1',
    initialValue: 'v1',
  })) as string | symbol;

  if (isCancel(vectorName)) {
    outro('Initialization cancelled');
    return 1;
  }

  // Prompt for default checks
  const checksChoice = (await select({
    message: 'Add default checks?',
    options: [
      {
        value: 'yes',
        label: 'Yes, add recommended checks (test, typecheck)',
      },
      { value: 'no', label: 'No, start empty' },
    ],
  })) as string | symbol;

  if (isCancel(checksChoice)) {
    outro('Initialization cancelled');
    return 1;
  }

  // Prompt for hook integration
  const setupHook = (await confirm({
    message: 'Set up Claude Code hook integration?',
    initialValue: true,
  })) as boolean | symbol;

  if (isCancel(setupHook)) {
    outro('Initialization cancelled');
    return 1;
  }

  // Now create the configuration
  const vectorDir = path.join(projectRoot, '.vector');
  const configPath = path.join(vectorDir, 'config.yaml');
  const claudeDir = path.join(projectRoot, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.local.json');

  // Create .vector directory
  fs.mkdirSync(vectorDir, { recursive: true });

  // Create config.yaml in interactive mode (always write to allow re-initialization)
  const configYaml =
    checksChoice === 'yes'
      ? generateConfigWithDefaults(vectorName as string)
      : generateEmptyConfigYaml(vectorName as string);
  fs.writeFileSync(configPath, configYaml, 'utf-8');

  // Create hook config if user accepted
  if (setupHook === true) {
    fs.mkdirSync(claudeDir, { recursive: true });

    let settings: any = {};

    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      try {
        settings = JSON.parse(content);
      } catch {
        settings = {};
      }
    }

    if (!settings.hooks) {
      settings.hooks = {};
    }

    const vectorHook = {
      type: HOOK_TYPE,
      command: DEFAULT_HOOK_COMMAND,
    };

    if (Array.isArray(settings.hooks.Stop)) {
      const alreadyExists = settings.hooks.Stop.some(
        (hook: any) => hook.command === DEFAULT_HOOK_COMMAND
      );
      if (!alreadyExists) {
        settings.hooks.Stop.push(vectorHook);
      }
    } else {
      settings.hooks.Stop = [vectorHook];
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  outro(
    `Vector initialized! Run 'vector run ${vectorName as string}' to execute checks.`
  );

  return 0;
}
