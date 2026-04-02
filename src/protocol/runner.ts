import { exec } from 'child_process';
import { promisify } from 'util';
import type { CheckDefinition } from '../config/schema';
import type { CheckResult } from './types';

const execAsync = promisify(exec);

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
 * @param options Configuration for running the check
 * @returns Result containing CheckResult and captured output
 */
export async function runCheck(options: RunCheckOptions): Promise<RunCheckResult> {
  const { name, definition, timeout } = options;
  const effectiveTimeout = definition.timeout ?? timeout;
  const startTime = Date.now();

  try {
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      // Execute the command with a timeout
      const { stdout, stderr } = await execAsync(definition.run, {
        shell: '/bin/bash',
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;

      // Capture output based on config
      const capturedStdout = definition.capture === 'stderr' ? '' : stdout;
      const capturedStderr = definition.capture === 'stdout' ? '' : stderr;

      const checkResult: CheckResult = {
        checkName: name,
        status: 'passed',
        duration,
      };

      return {
        checkResult,
        stdout: capturedStdout,
        stderr: capturedStderr,
      };
    } catch (error: unknown) {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        const checkResult: CheckResult = {
          checkName: name,
          status: 'failed',
          duration,
          details: {
            message: `Check timed out after ${effectiveTimeout}ms`,
          },
        };

        return {
          checkResult,
          stdout: '',
          stderr: '',
        };
      }

      // Handle non-zero exit code
      if (error instanceof Error && 'code' in error) {
        const exitCode = (error as any).code;
        if (typeof exitCode === 'number' && exitCode !== 0) {
          const stderr = (error as any).stderr || '';
          const stdout = (error as any).stdout || '';

          const checkResult: CheckResult = {
            checkName: name,
            status: 'failed',
            duration,
            details: {
              message: `Command exited with code ${exitCode}`,
            },
          };

          // Capture output based on config
          const capturedStdout = definition.capture === 'stderr' ? '' : stdout;
          const capturedStderr = definition.capture === 'stdout' ? '' : stderr;

          return {
            checkResult,
            stdout: capturedStdout,
            stderr: capturedStderr,
          };
        }
      }

      // Generic error handling for other failures
      const checkResult: CheckResult = {
        checkName: name,
        status: 'failed',
        duration,
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
      };

      return {
        checkResult,
        stdout: '',
        stderr: '',
      };
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    const checkResult: CheckResult = {
      checkName: name,
      status: 'failed',
      duration,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    };

    return {
      checkResult,
      stdout: '',
      stderr: '',
    };
  }
}
