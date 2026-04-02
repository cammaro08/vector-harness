import { spawn } from 'child_process';
import type { CheckDefinition } from '../config/schema';
import type { CheckResult } from './types';

export interface RunCheckOptions {
  name: string;
  definition: CheckDefinition;
  timeout: number; // ms
}

export interface RunCheckResult {
  checkResult: CheckResult;
  stdout: string;
  stderr: string;
}

/**
 * Execute a single check command and return the result.
 *
 * Uses spawn() with separate shell invocation to avoid command injection.
 * The command is passed to /bin/sh -c, which is safer than shell: '/bin/bash'.
 *
 * @param options Configuration for running the check
 * @returns Result containing CheckResult and captured output
 */
export async function runCheck(options: RunCheckOptions): Promise<RunCheckResult> {
  const { name, definition, timeout } = options;
  const effectiveTimeout = definition.timeout ?? timeout;
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Kill the process and all its children
        try {
          process.kill(-child.pid!);
        } catch {
          child.kill('SIGKILL');
        }

        const duration = Date.now() - startTime;
        const checkResult: CheckResult = {
          checkName: name,
          status: 'failed',
          duration,
          details: {
            message: `Check timed out after ${effectiveTimeout}ms`,
          },
        };
        resolve({
          checkResult,
          stdout: '',
          stderr: '',
        });
      }
    }, effectiveTimeout);

    // Spawn process: /bin/sh -c <command>
    // Use detached mode to kill process group on timeout
    const child = spawn('/bin/sh', ['-c', definition.run], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    // Capture output
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    // Handle process completion
    child.on('close', (code) => {
      if (resolved) return; // Already handled by timeout
      resolved = true;
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;

      // Determine if check passed (exit code 0)
      const passed = code === 0;

      // Capture output based on config
      const capturedStdout = definition.capture === 'stderr' ? '' : stdout;
      const capturedStderr = definition.capture === 'stdout' ? '' : stderr;

      const checkResult: CheckResult = {
        checkName: name,
        status: passed ? 'passed' : 'failed',
        duration,
        details: passed
          ? undefined
          : {
              message: `Command exited with code ${code || 1}`,
            },
      };

      resolve({
        checkResult,
        stdout: capturedStdout,
        stderr: capturedStderr,
      });
    });

    // Handle process errors
    child.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;

      const checkResult: CheckResult = {
        checkName: name,
        status: 'failed',
        duration,
        details: {
          message: `Failed to execute command: ${error.message}`,
        },
      };

      resolve({
        checkResult,
        stdout: '',
        stderr: '',
      });
    });
  });
}
