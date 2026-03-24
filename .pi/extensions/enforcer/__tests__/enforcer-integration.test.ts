import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { validateCommitMessage } from "../validators/commit-validator";
import { validateTests } from "../validators/test-validator";
import { validateDocs } from "../validators/doc-validator";
import { execSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, rmSync, readFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const CRUD_APP_PATH = "/home/talha/dev/vector-pi-enforcer-test/test-apps/crud-server";
const CRUD_APP_BACKUP = "/tmp/crud-server-backup";

interface ValidationResult {
  scenario: string;
  stagedFiles: string[];
  commitMessage: string;
  commitValid: boolean;
  testValid: boolean;
  docsValid: boolean;
  shouldBlock: boolean;
  actuallyBlocked: boolean;
  commitMessage_result: any;
  testValidator_result: any;
  docsValidator_result: any;
}

const results: ValidationResult[] = [];

describe("PI Enforcer Integration Tests", () => {
  beforeAll(() => {
    // Backup only non-test files
    if (existsSync(CRUD_APP_BACKUP)) {
      rmSync(CRUD_APP_BACKUP, { recursive: true });
    }
    mkdirSync(CRUD_APP_BACKUP, { recursive: true });

    const srcPath = join(CRUD_APP_PATH, "src");
    const backupSrcPath = join(CRUD_APP_BACKUP, "src");

    if (existsSync(srcPath)) {
      mkdirSync(backupSrcPath, { recursive: true });
      // Only backup non-test files
      execSync(`find "${srcPath}" -type f ! -name "*.test.ts" ! -name "*.spec.ts" -exec cp --parents {} "${CRUD_APP_BACKUP}" \\;`, {
        cwd: CRUD_APP_PATH,
      });
    }

    // Ensure we have a git repo set up for the CRUD app
    if (!existsSync(join(CRUD_APP_PATH, ".git"))) {
      execSync("git init", { cwd: CRUD_APP_PATH });
      execSync('git config user.email "test@example.com"', {
        cwd: CRUD_APP_PATH,
      });
      execSync('git config user.name "Test User"', { cwd: CRUD_APP_PATH });
    }
  });

  afterEach(() => {
    // Clean up staged files
    try {
      execSync("git reset", { cwd: CRUD_APP_PATH, stdio: "pipe" });
    } catch {
      // Ignore
    }

    // Delete all non-original files in src, then restore backups
    const srcPath = join(CRUD_APP_PATH, "src");
    const backupSrcPath = join(CRUD_APP_BACKUP, "src");

    // Remove all source files (but keep test files that came from backup)
    if (existsSync(srcPath)) {
      execSync(`find "${srcPath}" -type f ! -name "*.test.ts" ! -name "*.spec.ts" -delete`, {
        cwd: CRUD_APP_PATH,
      });
    }

    // Restore non-test files
    if (existsSync(backupSrcPath)) {
      mkdirSync(srcPath, { recursive: true });
      execSync(`find "${backupSrcPath}" -type f ! -name "*.test.ts" ! -name "*.spec.ts" -exec cp --parents {} "${srcPath}"/.. \\;`, {
        cwd: CRUD_APP_PATH,
      });
    }
  });

  function stageFilesAndValidate(
    scenario: string,
    stagedFiles: string[],
    commitMessage: string,
    expectedBlockage: boolean
  ) {
    // Reset git state
    try {
      execSync("git reset", { cwd: CRUD_APP_PATH, stdio: "pipe" });
    } catch {
      // Ignore
    }

    // Stage files by creating dummy content and adding them
    for (const file of stagedFiles) {
      const filePath = join(CRUD_APP_PATH, file);
      const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));

      // Create directory if needed
      mkdirSync(dirPath, { recursive: true });

      // Create/update file with dummy content
      writeFileSync(filePath, `// ${file}\nconst content = "${file}";`);

      // Stage the file
      execSync(`git add "${file}"`, { cwd: CRUD_APP_PATH });
    }

    // Run validators
    const commitResult = validateCommitMessage(commitMessage);
    const testResult = validateTests(stagedFiles, CRUD_APP_PATH);
    const docsResult = validateDocs(stagedFiles, CRUD_APP_PATH);

    // Determine if should be blocked
    const shouldBeBlocked =
      !commitResult.valid || !testResult.valid || !docsResult.valid;

    // Store result
    const result: ValidationResult = {
      scenario,
      stagedFiles,
      commitMessage,
      commitValid: commitResult.valid,
      testValid: testResult.valid,
      docsValid: docsResult.valid,
      shouldBlock: expectedBlockage,
      actuallyBlocked: shouldBeBlocked,
      commitMessage_result: commitResult,
      testValidator_result: testResult,
      docsValidator_result: docsResult,
    };

    results.push(result);

    // Verify expectation
    expect(shouldBeBlocked).toBe(
      expectedBlockage,
      `${scenario}: Expected blocked=${expectedBlockage}, got ${shouldBeBlocked}`
    );

    return result;
  }

  it("Scenario 1: Valid commit with good message, tests, and docs", () => {
    const result = stageFilesAndValidate(
      "Valid commit",
      ["src/auth.ts", "src/auth.test.ts", "docs/CHANGES.md"],
      `Update authentication middleware

This commit enhances the authentication system with better
token validation and improved error handling for edge cases.
The changes improve security by validating token signatures
and expiry times more thoroughly.`,
      false // should NOT be blocked
    );

    expect(result.commitValid).toBe(true);
    expect(result.testValid).toBe(true);
    expect(result.docsValid).toBe(true);
  });

  it("Scenario 2: Bad message - too short", () => {
    const result = stageFilesAndValidate(
      "Bad message - too short",
      ["src/auth.ts", "src/auth.test.ts"],
      "fix auth",
      true // should be blocked
    );

    expect(result.commitValid).toBe(false);
    expect(result.commitMessage_result.issues.some((i: string) =>
      i.includes("too short")
    )).toBe(true);
  });

  it("Scenario 3: Bad message - no body", () => {
    const result = stageFilesAndValidate(
      "Bad message - no body",
      ["src/auth.ts", "src/auth.test.ts"],
      "Update authentication middleware",
      true // should be blocked
    );

    expect(result.commitValid).toBe(false);
    expect(result.commitMessage_result.issues.some((i: string) =>
      i.includes("body")
    )).toBe(true);
  });

  it("Scenario 4: Missing tests - source changed without test file", () => {
    // For this scenario, we need to ensure the test file doesn't exist
    const srcPath = join(CRUD_APP_PATH, "src");
    const testFilePath = join(srcPath, "auth.test.ts");

    // Delete the test file if it exists
    if (existsSync(testFilePath)) {
      rmSync(testFilePath);
    }

    const result = stageFilesAndValidate(
      "Missing tests",
      ["src/auth.ts"],
      `Refactor auth system

This commit reorganizes the authentication module to improve
code clarity and maintainability. The changes are purely
structural and do not affect the public API or behavior.`,
      true // should be blocked
    );

    expect(result.testValid).toBe(false);
    expect(result.testValidator_result.missing).toContain("src/auth.ts");
  });

  it("Scenario 5: Source changed, docs not updated", () => {
    const result = stageFilesAndValidate(
      "Source changed, no docs",
      ["src/user-endpoints.ts", "src/user-endpoints.test.ts"],
      `Add new user endpoint

This commit introduces a new endpoint for bulk user
operations to improve performance when handling multiple
user updates in a single request.`,
      true // should be blocked
    );

    expect(result.docsValid).toBe(false);
  });

  it("Scenario 6: Only test files changed", () => {
    const result = stageFilesAndValidate(
      "Tests only changed",
      ["src/auth.test.ts"],
      `Add comprehensive auth tests

This commit adds edge case tests for the authentication
middleware to improve coverage and ensure proper handling
of malformed tokens and expired credentials.`,
      false // should NOT be blocked
    );

    expect(result.testValid).toBe(true);
    expect(result.docsValid).toBe(true); // docs check skipped for non-source
  });

  it("Scenario 7: Only docs changed", () => {
    const result = stageFilesAndValidate(
      "Docs only changed",
      ["docs/CHANGES.md"],
      `Update API documentation

This commit updates the API documentation to reflect
recent changes to the error response format and adds
new examples for authentication flows.`,
      false // should NOT be blocked
    );

    expect(result.docsValid).toBe(true);
  });
});

// Export results for capture script
export function getTestResults() {
  return results;
}
