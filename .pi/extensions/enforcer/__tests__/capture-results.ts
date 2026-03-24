import { validateCommitMessage } from "../validators/commit-validator";
import { validateTests } from "../validators/test-validator";
import { validateDocs } from "../validators/doc-validator";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CRUD_APP_PATH = "/home/talha/dev/vector-pi-enforcer-test/test-apps/crud-server";
const RESULTS_FILE = join(__dirname, "TEST_RESULTS.md");

interface ScenarioResult {
  scenario: string;
  stagedFiles: string[];
  commitMessage: string;
  expected: string;
  actualBlocked: boolean;
  actualMessage: string;
  status: string;
  commitResult: any;
  testResult: any;
  docsResult: any;
}

const scenarios = [
  {
    name: "Valid commit",
    stagedFiles: ["src/auth.ts", "src/auth.test.ts", "docs/CHANGES.md"],
    message: `Update authentication middleware

This commit enhances the authentication system with better
token validation and improved error handling for edge cases.
The changes improve security by validating token signatures
and expiry times more thoroughly.`,
    expectedBlocked: false,
  },
  {
    name: "Bad message - too short",
    stagedFiles: ["src/auth.ts", "src/auth.test.ts"],
    message: "fix auth",
    expectedBlocked: true,
  },
  {
    name: "Bad message - no body",
    stagedFiles: ["src/auth.ts", "src/auth.test.ts"],
    message: "Update authentication middleware",
    expectedBlocked: true,
  },
  {
    name: "Missing tests",
    stagedFiles: ["src/auth.ts"],
    message: `Refactor auth system

This commit reorganizes the authentication module to improve
code clarity and maintainability. The changes are purely
structural and do not affect the public API or behavior.`,
    expectedBlocked: true,
  },
  {
    name: "Source changed, no docs",
    stagedFiles: ["src/user-endpoints.ts", "src/user-endpoints.test.ts"],
    message: `Add new user endpoint

This commit introduces a new endpoint for bulk user
operations to improve performance when handling multiple
user updates in a single request.`,
    expectedBlocked: true,
  },
  {
    name: "Tests only changed",
    stagedFiles: ["src/auth.test.ts"],
    message: `Add comprehensive auth tests

This commit adds edge case tests for the authentication
middleware to improve coverage and ensure proper handling
of malformed tokens and expired credentials.`,
    expectedBlocked: false,
  },
  {
    name: "Docs only changed",
    stagedFiles: ["docs/CHANGES.md"],
    message: `Update API documentation

This commit updates the API documentation to reflect
recent changes to the error response format and adds
new examples for authentication flows.`,
    expectedBlocked: false,
  },
];

function runScenario(scenario: typeof scenarios[0]): ScenarioResult {
  // Reset staged files
  try {
    execSync("git reset", { cwd: CRUD_APP_PATH, stdio: "pipe" });
  } catch {
    // Ignore
  }

  // Stage files
  for (const file of scenario.stagedFiles) {
    const filePath = join(CRUD_APP_PATH, file);
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));

    // Create directory structure
    execSync(`mkdir -p "${dirPath}"`, { cwd: CRUD_APP_PATH });

    // Write dummy file
    writeFileSync(filePath, `// ${file}\nconst content = "${file}";`);

    // Stage the file
    execSync(`git add "${file}"`, { cwd: CRUD_APP_PATH });
  }

  // Run validators
  const commitResult = validateCommitMessage(scenario.message);
  const testResult = validateTests(scenario.stagedFiles, CRUD_APP_PATH);
  const docsResult = validateDocs(scenario.stagedFiles, CRUD_APP_PATH);

  // Determine if blocked
  const actualBlocked =
    !commitResult.valid || !testResult.valid || !docsResult.valid;

  // Determine actual message
  let actualMessage = "";
  if (!commitResult.valid) {
    actualMessage = `🚫 Commit blocked — poor commit message.\n\n${commitResult.message}`;
  } else if (!testResult.valid) {
    actualMessage = `🚫 Commit blocked — missing tests.\n\n${testResult.message}`;
  } else if (!docsResult.valid) {
    actualMessage = `⚠️ Commit blocked — docs not updated.\n\n${docsResult.message}`;
  } else {
    actualMessage = "✅ Commit allowed — all validations passed";
  }

  const status =
    actualBlocked === scenario.expectedBlocked
      ? "✅ PASS"
      : "❌ FAIL";

  return {
    scenario: scenario.name,
    stagedFiles: scenario.stagedFiles,
    commitMessage: scenario.message,
    expected: scenario.expectedBlocked ? "blocked" : "allowed",
    actualBlocked,
    actualMessage,
    status,
    commitResult,
    testResult,
    docsResult,
  };
}

function generateMarkdown(results: ScenarioResult[]): string {
  const now = new Date().toISOString().split("T")[0];
  const passCount = results.filter((r) => r.status === "✅ PASS").length;
  const failCount = results.filter((r) => r.status === "❌ FAIL").length;

  let md = `# PI Enforcer Integration Test Results

## Summary
- **Total Scenarios**: ${results.length}
- **Passed**: ${passCount}
- **Failed**: ${failCount}
- **Date**: ${now}

## Results Table

| Scenario | Expected | Actual | Status |
|---|---|---|---|
`;

  for (const result of results) {
    const expected = result.expected === "blocked" ? "🚫 blocked" : "✅ allowed";
    const actual = result.actualBlocked ? "🚫 blocked" : "✅ allowed";
    md += `| ${result.scenario} | ${expected} | ${actual} | ${result.status} |\n`;
  }

  md += `\n## Detailed Results\n`;

  for (const result of results) {
    md += `\n### Scenario: ${result.scenario}\n`;
    md += `**Status**: ${result.status}\n\n`;
    md += `**Staged Files**: \`${result.stagedFiles.join(", ")}\`\n\n`;
    md += `**Commit Message**:\n\`\`\`\n${result.commitMessage}\n\`\`\`\n\n`;
    md += `**Validation Results**:\n`;
    md += `- Commit Message: ${result.commitResult.valid ? "✅ VALID" : "❌ INVALID"}\n`;
    if (!result.commitResult.valid) {
      md += `  - Issues: ${result.commitResult.issues.join("; ")}\n`;
    }
    md += `- Tests: ${result.testResult.valid ? "✅ VALID" : "❌ INVALID"}\n`;
    if (!result.testResult.valid) {
      md += `  - Missing: ${result.testResult.missing.join(", ")}\n`;
    }
    md += `- Docs: ${result.docsResult.valid ? "✅ VALID" : "❌ INVALID"}\n`;
    if (!result.docsResult.valid) {
      md += `  - Reason: ${result.docsResult.message}\n`;
    }
    md += `\n**Output**:\n`;
    md += `\`\`\`\n${result.actualMessage}\n\`\`\`\n`;
  }

  md += `\n## Enforcer Validation Logic\n`;
  md += `The PI Enforcer blocks commits when ANY of these conditions are true:\n`;
  md += `1. **Commit message is invalid** (too short, missing body, poor quality)\n`;
  md += `2. **Source files have no tests** (must have .test.ts or .spec.ts file)\n`;
  md += `3. **Source code changed but docs not updated** (when source files in src/ change)\n`;
  md += `\nCommits with ONLY test or documentation changes bypass the source validation rules.\n`;

  return md;
}

async function main() {
  console.log("🔄 Running PI Enforcer integration test scenarios...\n");

  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    console.log(`Running: ${scenario.name}...`);
    const result = runScenario(scenario);
    results.push(result);
    console.log(
      `  ${result.status} (expected: ${result.expected}, actual: ${result.actualBlocked ? "blocked" : "allowed"})`
    );
  }

  console.log("\n✅ All scenarios executed\n");

  const markdown = generateMarkdown(results);
  writeFileSync(RESULTS_FILE, markdown);

  console.log(`📄 Results written to: ${RESULTS_FILE}`);
  console.log("\n📊 Summary:");
  const passCount = results.filter((r) => r.status === "✅ PASS").length;
  const failCount = results.filter((r) => r.status === "❌ FAIL").length;
  console.log(`   Passed: ${passCount}/${results.length}`);
  console.log(`   Failed: ${failCount}/${results.length}`);

  if (failCount > 0) {
    console.log("\n❌ Failed scenarios:");
    results
      .filter((r) => r.status === "❌ FAIL")
      .forEach((r) => {
        console.log(`   - ${r.scenario}`);
      });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
