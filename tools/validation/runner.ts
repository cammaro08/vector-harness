import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { formatReport } from '../terminalReporter';
import { writeReportToJSON, readReportFromJSON } from '../jsonLogger';
import { renderMarkdown } from '../ghPrCommenter';
import { EnforcementReport } from '../enforcementReport';
import {
  ValidationScenario,
  ScenarioOutput,
  ValidationRunResult,
} from './types';

/**
 * Create JSON envelope for a report.
 */
function createReportEnvelope(report: EnforcementReport): string {
  return JSON.stringify(
    {
      _meta: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        generator: 'vector-enforcer',
      },
      report,
    },
    null,
    2
  );
}

/**
 * Process a single scenario through all renderers.
 * Returns a ScenarioOutput with all rendered formats.
 */
export async function runScenario(
  scenario: ValidationScenario,
  cwd: string
): Promise<ScenarioOutput> {
  // Build the report
  const report = scenario.buildReport(cwd);

  // Render through all formatters
  const terminal = formatReport(report, { color: false });
  const terminalColored = formatReport(report, { color: true });

  // Write JSON to temp location and read it back
  const writeResult = await writeReportToJSON(report, { outputDir: cwd });
  let json = '';
  if (writeResult.success) {
    const readResult = await readReportFromJSON(writeResult.filePath);
    if (readResult.success) {
      json = createReportEnvelope(report);
    }
  }

  const markdown = renderMarkdown(report);

  return {
    scenarioId: scenario.id,
    description: scenario.description,
    terminal,
    terminalColored,
    json,
    markdown,
    verdict: report.verdict,
  };
}

/**
 * Process all scenarios and return aggregated result.
 */
export async function runAllScenarios(
  scenarios: readonly ValidationScenario[],
  cwd: string
): Promise<ValidationRunResult> {
  const outputs: ScenarioOutput[] = [];

  for (const scenario of scenarios) {
    const output = await runScenario(scenario, cwd);
    outputs.push(output);
  }

  // Calculate summary
  const total = outputs.length;
  const passed = outputs.filter((o) => o.verdict === 'pass').length;
  const failed = outputs.filter((o) => o.verdict === 'fail').length;

  // Aggregate tags
  const tags: Record<string, number> = {};
  for (const scenario of scenarios) {
    for (const tag of scenario.tags) {
      tags[tag] = (tags[tag] || 0) + 1;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    scenarios: outputs,
    summary: {
      total,
      passed,
      failed,
      tags,
    },
  };
}

/**
 * Write output artifacts to disk.
 */
export async function writeOutputArtifacts(
  result: ValidationRunResult,
  outputDir: string
): Promise<void> {
  // Create base output directory
  await mkdir(outputDir, { recursive: true });

  // Write summary.txt
  const summaryLines: string[] = [];
  summaryLines.push('Validation Run Summary');
  summaryLines.push('=====================');
  summaryLines.push('');
  summaryLines.push(`Timestamp: ${result.timestamp}`);
  summaryLines.push(`Total: ${result.summary.total}`);
  summaryLines.push(`Passed: ${result.summary.passed}`);
  summaryLines.push(`Failed: ${result.summary.failed}`);
  summaryLines.push('');

  if (Object.keys(result.summary.tags).length > 0) {
    summaryLines.push('Tags:');
    for (const [tag, count] of Object.entries(result.summary.tags)) {
      summaryLines.push(`  ${tag}: ${count}`);
    }
  }

  await writeFile(
    join(outputDir, 'summary.txt'),
    summaryLines.join('\n')
  );

  // Write scenarios subdirectory
  const scenariosDir = join(outputDir, 'scenarios');
  await mkdir(scenariosDir, { recursive: true });

  for (const output of result.scenarios) {
    const scenarioDir = join(scenariosDir, output.scenarioId);
    await mkdir(scenarioDir, { recursive: true });

    // Write terminal.txt (plain text, no ANSI)
    await writeFile(
      join(scenarioDir, 'terminal.txt'),
      output.terminal
    );

    // Write terminal-colored.txt (with ANSI codes)
    await writeFile(
      join(scenarioDir, 'terminal-colored.txt'),
      output.terminalColored
    );

    // Write report.json
    await writeFile(
      join(scenarioDir, 'report.json'),
      output.json
    );

    // Write pr-comment.md
    await writeFile(
      join(scenarioDir, 'pr-comment.md'),
      output.markdown
    );
  }

  // Write validation-run.json
  await writeFile(
    join(outputDir, 'validation-run.json'),
    JSON.stringify(result, null, 2)
  );
}
