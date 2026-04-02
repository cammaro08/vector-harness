/**
 * Vector v2 E2E Demo Runner
 *
 * Runs 5 end-to-end scenarios demonstrating core Vector v2 functionality.
 * Captures terminal output for PR documentation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { main } from '../../src/cli/index';

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DEMO_OUTPUT_DIR = path.resolve(__dirname, './output');

/**
 * Helper: Run a Vector command and capture output
 */
async function runVectorCommand(
  args: string[],
  workingDir: string
): Promise<{ exitCode: number; output: string }> {
  const originalCwd = process.cwd();
  const originalLog = console.log;
  const originalError = console.error;

  let output = '';

  // Capture console output
  console.log = (...args: any[]) => {
    const line = args.join(' ');
    output += line + '\n';
    originalLog(line);
  };

  console.error = (...args: any[]) => {
    const line = args.join(' ');
    output += line + '\n';
    originalError(line);
  };

  try {
    process.chdir(workingDir);
    const exitCode = await main([
      'node',
      'vector',
      ...args,
    ]);
    return { exitCode, output };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.chdir(originalCwd);
  }
}

/**
 * Scenario 1: Init + Run (all pass)
 */
async function scenario1() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 1: Init + Run (all pass)');
  console.log('='.repeat(80));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-demo-1-'));

  try {
    // Init
    console.log('\nInitializing project...');
    const { output: initOutput } = await runVectorCommand(['init'], tmpDir);

    // Create a simple passing config
    const configPath = path.join(tmpDir, '.vector', 'config.yaml');
    const passingConfig = `version: '2'
checks:
  echo-hello:
    run: 'echo "Hello, World!"'
    expect: exit-0
    enabled: true
  true-check:
    run: 'true'
    expect: exit-0
    enabled: true
vectors:
  v1:
    trigger: Demo vector with passing checks
    checks:
      - echo-hello
      - true-check
defaults:
  maxRetries: 3
  timeout: 30000
`;
    fs.writeFileSync(configPath, passingConfig);

    // Run
    console.log('\nRunning vector v1...');
    const { output: runOutput, exitCode } = await runVectorCommand(['run', 'v1'], tmpDir);

    const fullOutput = initOutput + '\n--- VECTOR RUN OUTPUT ---\n' + runOutput;
    fs.writeFileSync(path.join(DEMO_OUTPUT_DIR, 'scenario-1-all-pass.txt'), fullOutput);

    console.log(`✓ Scenario 1 complete (exit code: ${exitCode})`);
    return { success: exitCode === 0, output: fullOutput };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Scenario 2: Run with a failing check
 */
async function scenario2() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 2: Run with a failing check');
  console.log('='.repeat(80));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-demo-2-'));

  try {
    // Init
    console.log('\nInitializing project...');
    const { output: initOutput } = await runVectorCommand(['init'], tmpDir);

    // Create config with one passing and one failing check
    const configPath = path.join(tmpDir, '.vector', 'config.yaml');
    const mixedConfig = `version: '2'
checks:
  passing-check:
    run: 'echo "This passes"'
    expect: exit-0
    enabled: true
  failing-check:
    run: 'exit 1'
    expect: exit-0
    enabled: true
vectors:
  v1:
    trigger: Demo vector with a failing check
    checks:
      - passing-check
      - failing-check
defaults:
  maxRetries: 3
  timeout: 30000
`;
    fs.writeFileSync(configPath, mixedConfig);

    // Run (will fail)
    console.log('\nRunning vector v1 (with failure)...');
    const { output: runOutput, exitCode } = await runVectorCommand(['run', 'v1'], tmpDir);

    const fullOutput = initOutput + '\n--- VECTOR RUN OUTPUT ---\n' + runOutput;
    fs.writeFileSync(path.join(DEMO_OUTPUT_DIR, 'scenario-2-with-failure.txt'), fullOutput);

    console.log(`✓ Scenario 2 complete (exit code: ${exitCode})`);
    return { success: exitCode === 1, output: fullOutput };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Scenario 3: Activate/deactivate checks
 */
async function scenario3() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 3: Activate/deactivate checks');
  console.log('='.repeat(80));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-demo-3-'));

  try {
    // Init
    console.log('\nInitializing project...');
    const { output: initOutput } = await runVectorCommand(['init'], tmpDir);

    // Create config with two checks
    const configPath = path.join(tmpDir, '.vector', 'config.yaml');
    const testConfig = `version: '2'
checks:
  passing-check:
    run: 'true'
    expect: exit-0
    enabled: true
  failing-check:
    run: 'exit 1'
    expect: exit-0
    enabled: true
vectors:
  v1:
    trigger: Demo vector
    checks:
      - passing-check
      - failing-check
defaults:
  maxRetries: 3
  timeout: 30000
`;
    fs.writeFileSync(configPath, testConfig);

    let output = initOutput;

    // Run 1: Should fail
    console.log('\nRun 1: Both checks enabled (should fail)...');
    const { output: run1, exitCode: exit1 } = await runVectorCommand(['run', 'v1'], tmpDir);
    output += '\n--- RUN 1: BOTH CHECKS ENABLED (SHOULD FAIL) ---\n' + run1;

    // Activate: Disable the failing check
    console.log('\nActivating: disabling failing check...');
    const { output: activate } = await runVectorCommand(
      ['activate', '--vector', 'v1', '--check', 'failing-check', '--off'],
      tmpDir
    );
    output += '\n--- ACTIVATE: DISABLE FAILING CHECK ---\n' + activate;

    // Run 2: Should pass now
    console.log('\nRun 2: Only passing check enabled (should pass)...');
    const { output: run2, exitCode: exit2 } = await runVectorCommand(['run', 'v1'], tmpDir);
    output += '\n--- RUN 2: ONLY PASSING CHECK (SHOULD PASS) ---\n' + run2;

    // Re-enable the failing check
    console.log('\nRe-enabling: enabling failing check again...');
    const { output: reactivate } = await runVectorCommand(
      ['activate', '--vector', 'v1', '--check', 'failing-check', '--on'],
      tmpDir
    );
    output += '\n--- RE-ENABLE: ENABLE FAILING CHECK ---\n' + reactivate;

    // Run 3: Should fail again
    console.log('\nRun 3: Both checks enabled again (should fail)...');
    const { output: run3, exitCode: exit3 } = await runVectorCommand(['run', 'v1'], tmpDir);
    output += '\n--- RUN 3: BOTH CHECKS ENABLED AGAIN (SHOULD FAIL) ---\n' + run3;

    fs.writeFileSync(path.join(DEMO_OUTPUT_DIR, 'scenario-3-activate-deactivate.txt'), output);

    console.log(`✓ Scenario 3 complete (runs: fail=${exit1 === 1}, pass=${exit2 === 0}, fail_again=${exit3 === 1})`);
    return {
      success: exit1 === 1 && exit2 === 0 && exit3 === 1,
      output,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Scenario 4: Check add
 */
async function scenario4() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 4: Check add');
  console.log('='.repeat(80));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-demo-4-'));

  try {
    // Create a simple baseline config
    const vectorDir = path.join(tmpDir, '.vector');
    fs.mkdirSync(vectorDir, { recursive: true });

    const baselineConfig = `version: '2'
checks:
  baseline-check:
    run: 'echo "Baseline check"'
    expect: exit-0
    enabled: true
vectors:
  v1:
    trigger: Demo vector with custom checks
    checks:
      - baseline-check
defaults:
  maxRetries: 3
  timeout: 30000
`;
    const configPath = path.join(vectorDir, 'config.yaml');
    fs.writeFileSync(configPath, baselineConfig);

    console.log('\nProject initialized with baseline config');
    let output = '\n=== SCENARIO 4: Check add ===\n';
    output += 'Baseline config created\n';

    // Add a check
    console.log('\nAdding a new check via CLI...');
    const { output: addOutput } = await runVectorCommand(
      ['check', 'add', '--name', 'custom-check', '--run', 'echo "This is a custom check"'],
      tmpDir
    );
    output += '\n--- ADD CHECK OUTPUT ---\n' + addOutput;

    // Read config to verify
    console.log('\nVerifying check in config.yaml...');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    output += '\n--- CONFIG.YAML CONTENT AFTER ADD ---\n' + configContent;

    // Run with both checks
    console.log('\nRunning vector with both checks...');
    const { output: runOutput, exitCode } = await runVectorCommand(['run', 'v1'], tmpDir);
    output += '\n--- RUN WITH BOTH CHECKS ---\n' + runOutput;

    fs.writeFileSync(path.join(DEMO_OUTPUT_DIR, 'scenario-4-check-add.txt'), output);

    console.log(`✓ Scenario 4 complete (exit code: ${exitCode})`);
    return { success: exitCode === 0, output };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Scenario 5: Report command
 */
async function scenario5() {
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO 5: Report command');
  console.log('='.repeat(80));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-demo-5-'));

  try {
    // Init
    console.log('\nInitializing project...');
    const { output: initOutput } = await runVectorCommand(['init'], tmpDir);

    // Create simple config
    const configPath = path.join(tmpDir, '.vector', 'config.yaml');
    const simpleConfig = `version: '2'
checks:
  simple-check:
    run: 'echo "test"'
    expect: exit-0
    enabled: true
vectors:
  v1:
    trigger: Test vector
    checks:
      - simple-check
defaults:
  maxRetries: 3
  timeout: 30000
`;
    fs.writeFileSync(configPath, simpleConfig);

    let output = initOutput;

    // Run to create report
    console.log('\nRunning vector v1 to create report...');
    const { output: runOutput } = await runVectorCommand(['run', 'v1'], tmpDir);
    output += '\n--- VECTOR RUN ---\n' + runOutput;

    // Report default
    console.log('\nGenerating report (default format)...');
    const { output: reportDefault } = await runVectorCommand(['report'], tmpDir);
    output += '\n--- REPORT (DEFAULT) ---\n' + reportDefault;

    // Report JSON
    console.log('\nGenerating report (JSON format)...');
    const { output: reportJson } = await runVectorCommand(['report', '--format', 'json'], tmpDir);
    output += '\n--- REPORT (JSON) ---\n' + reportJson;

    // Report markdown
    console.log('\nGenerating report (markdown format)...');
    const { output: reportMarkdown } = await runVectorCommand(['report', '--format', 'markdown'], tmpDir);
    output += '\n--- REPORT (MARKDOWN) ---\n' + reportMarkdown;

    fs.writeFileSync(path.join(DEMO_OUTPUT_DIR, 'scenario-5-report.txt'), output);

    console.log(`✓ Scenario 5 complete`);
    return { success: true, output };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Main: Run all scenarios
 */
async function runAllScenarios() {
  console.log('\n' + '█'.repeat(80));
  console.log('█ VECTOR V2 END-TO-END DEMO');
  console.log('█'.repeat(80));

  const results = [];

  try {
    results.push({ scenario: 1, result: await scenario1() });
    results.push({ scenario: 2, result: await scenario2() });
    results.push({ scenario: 3, result: await scenario3() });
    results.push({ scenario: 4, result: await scenario4() });
    results.push({ scenario: 5, result: await scenario5() });

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('DEMO SUMMARY');
    console.log('='.repeat(80));

    results.forEach(({ scenario, result }) => {
      const status = result.success ? '✓ PASS' : '✗ FAIL';
      console.log(`Scenario ${scenario}: ${status}`);
    });

    const allPass = results.every(r => r.result.success);
    console.log('\n' + 'Overall: ' + (allPass ? '✓ ALL PASS' : '✗ SOME FAILURES'));
    console.log(`\nOutput files saved to: ${DEMO_OUTPUT_DIR}`);
    console.log('='.repeat(80));

    return allPass ? 0 : 1;
  } catch (error) {
    console.error(`\n✗ Demo failed with error: ${(error as Error).message}`);
    console.error((error as Error).stack);
    return 1;
  }
}

// Run
runAllScenarios().then(exitCode => process.exit(exitCode));
