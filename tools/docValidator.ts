import { access, readdir } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';

export interface DocValidationResult {
  hasProgressLog: boolean;     // docs/PROGRESS_LOG.md exists
  hasDocs: boolean;            // docs/ directory has at least one .md file
  passes: boolean;             // all required checks pass
  missing: string[];           // list of missing required files/patterns
  checked: string[];           // list of paths that were checked
}

export interface DocValidatorOptions {
  cwd: string;
  requiredFiles?: string[];    // additional required file paths (relative to cwd)
  requireProgressLog?: boolean;  // default true
}

/**
 * Check if a file exists at the given path
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if docs/ directory has at least one .md file
 */
async function hasMdFilesInDocs(docsPath: string): Promise<boolean> {
  try {
    const files = await readdir(docsPath);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    return mdFiles.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Validates that required documentation exists
 */
export async function validateDocs(options: DocValidatorOptions): Promise<DocValidationResult> {
  const { cwd, requiredFiles = [], requireProgressLog = true } = options;
  const missing: string[] = [];
  const checked: string[] = [];

  // Check PROGRESS_LOG.md if required
  let hasProgressLog = true;
  if (requireProgressLog) {
    const progressLogPath = join(cwd, 'docs', 'PROGRESS_LOG.md');
    const exists = await fileExists(progressLogPath);
    if (!exists) {
      hasProgressLog = false;
      missing.push('docs/PROGRESS_LOG.md');
    }
    checked.push(progressLogPath);
  }

  // Check additional required files
  for (const file of requiredFiles) {
    const filePath = join(cwd, file);
    const exists = await fileExists(filePath);
    if (!exists) {
      missing.push(file);
    }
    checked.push(filePath);
  }

  // Check for at least one .md file in docs/
  const docsPath = join(cwd, 'docs');
  const hasDocs = await hasMdFilesInDocs(docsPath);
  checked.push(docsPath);

  // Determine if all checks pass
  const passes = hasProgressLog && hasDocs && missing.length === 0;

  return {
    hasProgressLog,
    hasDocs,
    passes,
    missing,
    checked
  };
}
