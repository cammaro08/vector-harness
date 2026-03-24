import { execSync } from "node:child_process";
import * as path from "path";

function validateCwd(cwd: string): string {
  const resolved = path.resolve(cwd);
  if (!path.isAbsolute(resolved)) {
    throw new Error(`Invalid working directory: must be absolute path, got: ${cwd}`);
  }
  return resolved;
}

export function getStagedFiles(cwd: string): string[] {
  try {
    const validatedCwd = validateCwd(cwd);
    const output = execSync("git diff --cached --name-only", {
      cwd: validatedCwd,
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function getChangedFiles(cwd: string): string[] {
  try {
    const validatedCwd = validateCwd(cwd);
    const output = execSync("git diff --name-only", {
      cwd: validatedCwd,
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function getAllChangedFiles(cwd: string): string[] {
  const staged = getStagedFiles(cwd);
  const unstaged = getChangedFiles(cwd);
  return [...new Set([...staged, ...unstaged])];
}

export function extractCommitMessage(command: string): string | null {
  // Validate command length to prevent ReDoS attacks
  if (command.length > 10000) {
    throw new Error(`Command too long for safe parsing (${command.length} chars, max 10000)`);
  }

  // Match -m "...", -m '...', or -m ...
  // Handle escaped quotes inside the message
  const doubleQuoteMatch = command.match(
    /git\s+commit\s+.*?-m\s+"((?:[^"\\]|\\.)*)"/
  );
  if (doubleQuoteMatch) return doubleQuoteMatch[1].replace(/\\"/g, '"');

  const singleQuoteMatch = command.match(
    /git\s+commit\s+.*?-m\s+'((?:[^'\\]|\\.)*)'/
  );
  if (singleQuoteMatch) return singleQuoteMatch[1].replace(/\\'/g, "'");

  // Heredoc style: -m "$(cat <<'EOF' ... EOF )"
  const heredocMatch = command.match(
    /git\s+commit\s+.*?-m\s+"\$\(cat\s+<<'?EOF'?\s*\n([\s\S]*?)\n\s*EOF\s*\)"/
  );
  if (heredocMatch) return heredocMatch[1].trim();

  // Unquoted (single word)
  const unquotedMatch = command.match(/git\s+commit\s+.*?-m\s+(\S+)/);
  if (unquotedMatch) return unquotedMatch[1];

  return null;
}
