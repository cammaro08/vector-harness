#!/usr/bin/env ts-node
/**
 * CLI entry point for the validation harness.
 *
 * Usage:
 *   npx ts-node tools/validation/run.ts            # run all scenarios
 *   npx ts-node tools/validation/run.ts --tag pass  # filter by tag
 *   npx ts-node tools/validation/run.ts --tag retry --tag escalation
 *
 * Output is written to validation-output/ and printed to stdout.
 */
import { join } from 'path';
import { allScenarios } from './scenarios';
import { runAllScenarios, writeOutputArtifacts } from './runner';
import { ValidationScenario } from './types';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  const outputDir = join(cwd, 'validation-output');

  // Parse --tag filters
  const tags: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && i + 1 < args.length) {
      tags.push(args[i + 1]);
      i++;
    }
  }

  // Filter scenarios
  let scenarios: readonly ValidationScenario[] = allScenarios;
  if (tags.length > 0) {
    scenarios = allScenarios.filter((s) =>
      s.tags.some((t) => tags.includes(t))
    );
    console.log(`Filtering by tags: ${tags.join(', ')}`);
    console.log(`Matched ${scenarios.length} of ${allScenarios.length} scenarios\n`);
  }

  if (scenarios.length === 0) {
    console.log('No scenarios matched. Available tags:');
    const allTags = [...new Set(allScenarios.flatMap((s) => [...s.tags]))];
    console.log(`  ${allTags.join(', ')}`);
    process.exit(1);
  }

  // Run all scenarios
  console.log(`Running ${scenarios.length} validation scenarios...\n`);
  const result = await runAllScenarios(scenarios, outputDir);

  // Print each scenario's terminal output
  for (const output of result.scenarios) {
    console.log(`--- ${output.scenarioId}: ${output.description} ---`);
    console.log(output.terminalColored);
    console.log('');
  }

  // Write artifacts
  await writeOutputArtifacts(result, outputDir);

  // Print summary
  console.log('═'.repeat(50));
  console.log('  VALIDATION SUMMARY');
  console.log('═'.repeat(50));
  console.log(`  Scenarios: ${result.summary.total}`);
  console.log(`  Passed:    ${result.summary.passed}`);
  console.log(`  Failed:    ${result.summary.failed}`);
  console.log(`  Tags:      ${Object.entries(result.summary.tags).map(([t, c]) => `${t}(${c})`).join(' ')}`);
  console.log('═'.repeat(50));
  console.log(`\n  Artifacts written to: ${outputDir}/`);
  console.log('  Files per scenario:');
  console.log('    scenarios/{id}/terminal.txt');
  console.log('    scenarios/{id}/terminal-colored.txt');
  console.log('    scenarios/{id}/report.json');
  console.log('    scenarios/{id}/pr-comment.md');
  console.log('  Global:');
  console.log('    summary.txt');
  console.log('    validation-run.json\n');
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
