/**
 * Init Command
 *
 * Initializes a Vector project by creating .vector/config.yaml
 * and updating .claude/settings.local.json with hook configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateDefaultConfigYaml } from '../../config';

/**
 * Initialize a Vector project.
 *
 * Creates:
 * - .vector/config.yaml (if not exists)
 * - .claude/settings.local.json with Stop hook
 *
 * Returns 0 on success, 1 on failure.
 */
export async function initCommand(projectRoot: string): Promise<number> {
  try {
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
      console.log(`Created ${configPath}`);
    } else {
      console.log(
        `Config already exists at ${configPath}, skipping creation`
      );
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

    // Set up Stop hook
    settings.hooks.Stop = [
      {
        type: 'command',
        command: 'npx vector run v1',
      },
    ];

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log(`Created/updated ${settingsPath}`);

    console.log('✓ Vector project initialized');
    return 0;
  } catch (error) {
    console.error(
      `Failed to initialize Vector project: ${(error as Error).message}`
    );
    return 1;
  }
}
