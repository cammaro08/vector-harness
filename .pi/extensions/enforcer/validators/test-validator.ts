import { existsSync } from "node:fs";
import { join, dirname, basename, extname, resolve, relative } from "node:path";

/**
 * Checks if a resolved file path stays within the project root (cwd).
 * Prevents path traversal attacks via crafted file paths.
 */
function isPathInBounds(cwd: string, filePath: string): boolean {
  const resolvedCwd = resolve(cwd);
  const resolvedFile = resolve(cwd, filePath);
  const relPath = relative(resolvedCwd, resolvedFile);
  // If the relative path starts with '..', it escapes the project root
  return !relPath.startsWith('..');
}

const EXCLUDED_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.d\.ts$/,
  /\.config\.ts$/,
  /\.config\.js$/,
  /\.config\.mjs$/,
  /\.config\.cjs$/,
];

function isSourceFile(file: string): boolean {
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) return false;
  return !EXCLUDED_PATTERNS.some((pattern) => pattern.test(file));
}

function getTestCandidates(file: string): string[] {
  const dir = dirname(file);
  const ext = extname(file);
  const name = basename(file, ext);

  const candidates = [
    // Co-located
    join(dir, `${name}.test${ext}`),
    join(dir, `${name}.spec${ext}`),
  ];

  // Mirrored under tests/ or test/ (strip leading src/ if present)
  const relative = file.startsWith("src/") ? file.slice(4) : file;
  const relDir = dirname(relative);
  const relName = basename(relative, ext);

  candidates.push(
    join("tests", relDir, `${relName}.test${ext}`),
    join("test", relDir, `${relName}.test${ext}`),
    join("tests", relDir, `${relName}.spec${ext}`),
    join("test", relDir, `${relName}.spec${ext}`)
  );

  return candidates;
}

export function validateTests(
  changedFiles: string[],
  cwd: string
): { valid: boolean; missing: string[]; message: string } {
  // Filter out any files that try to escape the project root
  const safeChangedFiles = changedFiles.filter(f => isPathInBounds(cwd, f));
  const sourceFiles = safeChangedFiles.filter(isSourceFile);
  const missing: string[] = [];

  for (const file of sourceFiles) {
    const candidates = getTestCandidates(file);
    const hasTest = candidates.some((candidate) => {
      // Skip candidates that try to escape the project root
      if (!isPathInBounds(cwd, candidate)) {
        return false;
      }
      return existsSync(join(cwd, candidate));
    });

    if (!hasTest) {
      // Also check if the test file is among the changed files themselves
      const hasTestInChanges = candidates.some((candidate) =>
        changedFiles.includes(candidate)
      );
      if (!hasTestInChanges) {
        missing.push(file);
      }
    }
  }

  if (missing.length === 0) {
    return { valid: true, missing: [], message: "All source files have tests." };
  }

  const fileList = missing.map((f) => `  - ${f}`).join("\n");
  return {
    valid: false,
    missing,
    message: `Missing test files for:\n${fileList}\n\nEach source file needs a corresponding .test.ts or .spec.ts file (co-located or under tests/).`,
  };
}
