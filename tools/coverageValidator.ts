import { spawn } from 'child_process';

export interface CoverageResult {
  lines: number;
  statements: number;
  branches: number;
  functions: number;
  overall: number;
  threshold: number;
  passes: boolean;
  details: string;
  parseError?: string;
}

export interface CoverageOptions {
  cwd: string;
  threshold?: number;
  command?: string;
  timeout?: number;
}

export async function validateCoverage(
  options: CoverageOptions
): Promise<CoverageResult> {
  const {
    cwd,
    threshold = 80,
    command = 'npm run test:coverage',
    timeout = 60000
  } = options;

  const [executable, ...args] = command.split(/\s+/);
  const output = await executeCommand(executable, args, cwd, timeout);

  const metrics = parseCoverageOutput(output);

  if (!metrics) {
    const errorMessage = 'Failed to parse coverage output: no "All files" row found';
    return {
      lines: 0,
      statements: 0,
      branches: 0,
      functions: 0,
      overall: 0,
      threshold,
      passes: false,
      details: output,
      parseError: errorMessage
    };
  }

  const overall = calculateOverall(metrics);
  const passes = overall >= threshold;

  return {
    lines: metrics.lines,
    statements: metrics.statements,
    branches: metrics.branches,
    functions: metrics.functions,
    overall,
    threshold,
    passes,
    details: output
  };
}

interface CoverageMetrics {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

function executeCommand(
  executable: string,
  args: string[],
  cwd: string,
  timeout: number = 60000
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    let timeoutHandle: NodeJS.Timeout | null = null;
    let isResolved = false;

    const process = spawn(executable, args, {
      cwd,
      shell: true
    });

    timeoutHandle = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        process.kill();
        reject(new Error(`Command execution timeout after ${timeout}ms`));
      }
    }, timeout);

    process.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    process.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    process.on('close', (code: number) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (!isResolved) {
        isResolved = true;
        if (code !== 0 || !output.trim()) {
          reject(
            new Error(
              `Command failed with exit code ${code}: ${errorOutput || 'No output'}`
            )
          );
        } else {
          resolve(output);
        }
      }
    });

    process.on('error', (err) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (!isResolved) {
        isResolved = true;
        reject(err);
      }
    });
  });
}

function parseCoverageOutput(output: string): CoverageMetrics | null {
  const match = extractAllFilesRow(output);

  if (!match) {
    return null;
  }

  return {
    statements: parseFloat(match[1]),
    branches: parseFloat(match[2]),
    functions: parseFloat(match[3]),
    lines: parseFloat(match[4])
  };
}

function extractAllFilesRow(output: string): RegExpMatchArray | null {
  // Pattern: "All files" followed by pipe-separated percentage values
  // Matches formats: "All files | 85.71 | 83.33 | 88.89 | 87.50"
  // Handles optional whitespace around pipes and decimal/non-decimal values
  const allFilesPattern = /All files\s*\|\s+([\d.]+)\s*\|\s+([\d.]+)\s*\|\s+([\d.]+)\s*\|\s+([\d.]+)/;

  return output.match(allFilesPattern);
}

function calculateOverall(metrics: CoverageMetrics): number {
  const sum = metrics.statements + metrics.branches + metrics.functions + metrics.lines;
  return sum / 4;
}
