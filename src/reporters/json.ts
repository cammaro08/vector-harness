import {
  writeReportToJSON as v1WriteReportToJSON,
  readReportFromJSON as v1ReadReportFromJSON,
} from '../../tools/jsonLogger';
import { EnforcementReport } from '../protocol/types';

export interface JSONWriteResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface JSONReadResult {
  success: boolean;
  report?: EnforcementReport;
  error?: string;
}

/**
 * Write an EnforcementReport to a JSON file.
 * Thin wrapper around v1 writeReportToJSON.
 */
export async function writeJSON(
  report: EnforcementReport,
  outputDir?: string
): Promise<JSONWriteResult> {
  const result = await v1WriteReportToJSON(report, { outputDir });
  if (result.success) {
    return {
      success: true,
      filePath: result.filePath,
    };
  }
  return {
    success: false,
    error: result.error,
  };
}

/**
 * Read an EnforcementReport from a JSON file.
 * Thin wrapper around v1 readReportFromJSON.
 */
export async function readJSON(filePath: string): Promise<JSONReadResult> {
  const result = await v1ReadReportFromJSON(filePath);
  if (result.success) {
    return {
      success: true,
      report: result.report,
    };
  }
  return {
    success: false,
    error: result.error,
  };
}
