import { validateCommitMessage } from "./validators/commit-validator";
import { validateTests } from "./validators/test-validator";
import { validateDocs } from "./validators/doc-validator";
import { getStagedFiles, extractCommitMessage } from "./utils/git";

interface ToolCallEvent {
  toolName: string;
  input: { command?: string; [key: string]: unknown };
}

interface ContextEvent {
  messages: Array<{ role: string; content: string }>;
}

interface HookContext {
  cwd: string;
}

interface ExtensionAPI {
  on(
    event: "tool_call",
    handler: (
      event: ToolCallEvent,
      ctx: HookContext
    ) => Promise<{ blocked: true; message: string } | undefined>
  ): void;
  on(
    event: "context",
    handler: (event: ContextEvent, ctx: HookContext) => Promise<void>
  ): void;
  registerTool?(name: string, handler: unknown): void;
}

function isGitCommit(command: string): boolean {
  return /\bgit\s+commit\b/.test(command);
}

function isGitAddOrCommit(command: string): boolean {
  return /\bgit\s+(add|commit)\b/.test(command);
}

export default function (pi: ExtensionAPI) {
  // Hook: Validate commit messages on git commit
  pi.on("tool_call", async (event: ToolCallEvent, ctx: HookContext) => {
    if (event.toolName !== "bash") return undefined;
    const cmd = event.input.command;
    if (!cmd || !isGitCommit(cmd)) return undefined;

    // 1. Validate commit message
    const msg = extractCommitMessage(cmd);
    if (msg) {
      const commitResult = validateCommitMessage(msg);
      if (!commitResult.valid) {
        return {
          blocked: true,
          message: `🚫 Commit blocked — poor commit message.\n\n${commitResult.message}\n\nWrite a detailed commit message with:\n- Subject line (under 72 chars)\n- Blank line\n- Body explaining what changed, why, and how (at least 2 lines)`,
        };
      }
    }

    // 2. Validate tests exist for staged files
    const staged = getStagedFiles(ctx.cwd);
    const testResult = validateTests(staged, ctx.cwd);
    if (!testResult.valid) {
      return {
        blocked: true,
        message: `🚫 Commit blocked — missing tests.\n\n${testResult.message}\n\nCreate the missing test files before committing.`,
      };
    }

    // 3. Validate docs updated
    const docResult = validateDocs(staged, ctx.cwd);
    if (!docResult.valid) {
      return {
        blocked: true,
        message: `⚠️ Commit blocked — docs not updated.\n\n${docResult.message}`,
      };
    }

    return undefined;
  });

  // Hook: Pre-check on git add (warn early about missing tests)
  pi.on("tool_call", async (event: ToolCallEvent, ctx: HookContext) => {
    if (event.toolName !== "bash") return undefined;
    const cmd = event.input.command;
    if (!cmd || !isGitAddOrCommit(cmd) || isGitCommit(cmd)) return undefined;

    // For git add, just do a soft check on staged files after the add
    // We don't block git add, only warn
    return undefined;
  });

  // Hook: Inject enforcement rules into system context
  pi.on("context", async (event: ContextEvent, _ctx: HookContext) => {
    event.messages.unshift({
      role: "user",
      content: `[ENFORCEMENT RULES — PI Coding Agent]
These rules are enforced automatically. Violations will block your commits.

1. **Every .ts source file MUST have a corresponding .test.ts file.**
   - Co-located (src/foo/bar.test.ts) or mirrored (tests/foo/bar.test.ts)
   - Write tests before or alongside your code, not after

2. **When changing source code, update relevant documentation.**
   - Update docs/, README.md, or PROGRESS_LOG.md to reflect changes
   - If only tests/docs change, this rule is skipped

3. **Commit messages MUST be detailed and descriptive.**
   - Subject line: concise summary, under 72 characters
   - Blank line after subject
   - Body: at least 2 lines explaining what changed, why, and how
   - Example:
     \`\`\`
     Add user authentication middleware

     Implement JWT-based auth middleware that validates tokens on
     protected routes. This replaces the session-based auth which
     had scaling issues with our Redis cluster.

     - Validates JWT signature and expiry
     - Extracts user context for downstream handlers
     - Returns 401 with specific error codes for debugging
     \`\`\`

Commits that violate these rules will be **blocked**. Fix the issues and retry.`,
    });
  });
}
