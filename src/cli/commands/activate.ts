/**
 * Activate Command
 *
 * Modifies .vector/active.yaml to enable/disable checks for specific vectors.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { loadActiveConfig } from '../../config';
import { ActiveConfig, VectorName } from '../../config/schema';

/**
 * Activate/deactivate a check for a vector.
 *
 * Reads active.yaml, toggles the check, and writes back.
 *
 * Flags:
 * - --check <name>: check name to toggle
 * - --vector <v1-v5>: vector to modify
 * - --on: enable the check
 * - --off: disable the check
 *
 * Returns 0 on success, 1 on failure.
 */
export async function activateCommand(
  flags: Record<string, string | boolean>,
  projectRoot: string
): Promise<number> {
  try {
    const checkName = flags.check as string;
    const vectorName = flags.vector as string;
    const isOn = flags.on === true;
    const isOff = flags.off === true;

    if (!checkName) {
      console.error('Error: --check flag is required');
      return 1;
    }

    if (!vectorName) {
      console.error('Error: --vector flag is required');
      return 1;
    }

    if (!isOn && !isOff) {
      console.error('Error: either --on or --off flag is required');
      return 1;
    }

    // Load or create active config
    let active = loadActiveConfig(projectRoot);
    if (!active) {
      active = { vectors: {} };
    }

    // Ensure vector exists in active config
    const vn = vectorName as VectorName;
    if (!active.vectors[vn]) {
      active.vectors[vn] = [];
    }

    const checks = active.vectors[vn] as string[];

    // Toggle the check
    if (isOn) {
      if (!checks.includes(checkName)) {
        checks.push(checkName);
      }
      console.log(`[vector] Enabled check '${checkName}' for vector '${vectorName}'`);
    } else if (isOff) {
      const index = checks.indexOf(checkName);
      if (index !== -1) {
        checks.splice(index, 1);
      }
      console.log(`[vector] Disabled check '${checkName}' for vector '${vectorName}'`);
    }

    // Show current active checks for this vector
    console.log(`[vector] Active checks for ${vectorName}: ${checks.length > 0 ? checks.join(', ') : '(none — will use project defaults)'}`);

    // Write back to active.yaml
    const vectorDir = path.join(projectRoot, '.vector');
    fs.mkdirSync(vectorDir, { recursive: true });

    const activePath = path.join(vectorDir, 'active.yaml');
    const yaml_str = yaml.dump(active, {
      indent: 2,
      lineWidth: -1,
    });
    fs.writeFileSync(activePath, yaml_str, 'utf-8');

    return 0;
  } catch (error) {
    console.error(`Failed to activate check: ${(error as Error).message}`);
    return 1;
  }
}
