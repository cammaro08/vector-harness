import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { EnforcementReport } from './enforcementReport';

export interface WriteOptions {
  outputDir?: string;
}

export type WriteResult =
  | { success: true; filePath: string }
  | { success: false; error: string };

export type ReadResult =
  | { success: true; report: EnforcementReport }
  | { success: false; error: string };

interface EnvelopeData {
  _meta: {
    version: string;
    generatedAt: string;
    generator: string;
  };
  report: EnforcementReport;
}

/**
 * Write an EnforcementReport to a JSON file
 * @param report The report to write
 * @param opts Optional configuration (outputDir override)
 * @returns Result with filepath or error
 */
export async function writeReportToJSON(
  report: EnforcementReport,
  opts?: WriteOptions
): Promise<WriteResult> {
  try {
    // Determine output directory
    const outputDir = opts?.outputDir || join(report.environment.cwd, 'docs');

    // Create directory if it doesn't exist
    await mkdir(outputDir, { recursive: true });

    // Build envelope with metadata
    const generatedAt = new Date().toISOString();
    const envelope: EnvelopeData = {
      _meta: {
        version: '1.0.0',
        generatedAt,
        generator: 'vector-enforcer',
      },
      report,
    };

    // Write file with 2-space indentation
    // Use timestamp-based filename to avoid race conditions with concurrent writes
    // Format: enforcement-report-YYYY-MM-DDTHH-MM-SS-sssZ.json
    const timestamp = generatedAt.replace(/[:.]/g, '-');
    const filePath = join(outputDir, `enforcement-report-${timestamp}.json`);
    const absolutePath = resolve(filePath);
    await writeFile(absolutePath, JSON.stringify(envelope, null, 2));

    return { success: true, filePath: absolutePath };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Read an EnforcementReport from a JSON file
 * @param path Absolute path to the JSON file
 * @returns Result with report or error
 */
export async function readReportFromJSON(path: string): Promise<ReadResult> {
  try {
    // Read the file
    const content = await readFile(path, 'utf-8');

    // Parse JSON
    const envelope = JSON.parse(content) as EnvelopeData;

    // Extract and return the report
    return { success: true, report: envelope.report };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}
