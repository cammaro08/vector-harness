const SOURCE_PATTERNS = [/^src\/.*\.tsx?$/];

const DOC_PATTERNS = [
  /^docs\//,
  /^README\.md$/i,
  /^PROGRESS_LOG\.md$/i,
  /\.md$/,
];

const NON_SOURCE_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.d\.ts$/,
  /^tests?\//,
  /^docs\//,
  /\.md$/i,
];

function isSourceCode(file: string): boolean {
  return SOURCE_PATTERNS.some((p) => p.test(file));
}

function isDocFile(file: string): boolean {
  return DOC_PATTERNS.some((p) => p.test(file));
}

function isNonSourceFile(file: string): boolean {
  return NON_SOURCE_PATTERNS.some((p) => p.test(file));
}

export function validateDocs(
  changedFiles: string[],
  cwd: string
): { valid: boolean; message: string } {
  const hasSourceChanges = changedFiles.some(isSourceCode);
  const hasDocChanges = changedFiles.some(isDocFile);

  // If no source code changed, auto-pass
  if (!hasSourceChanges) {
    return { valid: true, message: "No source changes — docs check skipped." };
  }

  // If only non-source files changed, auto-pass
  const allNonSource = changedFiles.every(isNonSourceFile);
  if (allNonSource) {
    return {
      valid: true,
      message: "Only tests/docs changed — docs check skipped.",
    };
  }

  // Source code changed — docs must also be updated
  if (!hasDocChanges) {
    return {
      valid: false,
      message:
        "Source code was changed but no documentation was updated. Update relevant docs (docs/, README.md, or PROGRESS_LOG.md) to reflect the changes.",
    };
  }

  return { valid: true, message: "Docs updated alongside source changes." };
}
