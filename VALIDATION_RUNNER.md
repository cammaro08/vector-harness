# Validation Runner Module

## Overview

The validation runner (`tools/validation/runner.ts`) executes enforcement report scenarios through all available renderers and produces comprehensive output artifacts for testing and validation.

## Core API

### runScenario(scenario, cwd)

Process a single scenario through all renderers.

```typescript
const output = await runScenario(mockScenario, tempDir);
// Output contains: terminal, terminalColored, json, markdown, verdict
```

**Returns:** `Promise<ScenarioOutput>` with all rendered formats

### runAllScenarios(scenarios, cwd)

Process multiple scenarios and aggregate results.

```typescript
const result = await runAllScenarios([scenario1, scenario2], tempDir);
// result.summary contains: total, passed, failed, tags
```

**Returns:** `Promise<ValidationRunResult>` with scenarios and summary stats

### writeOutputArtifacts(result, outputDir)

Write all output artifacts to disk with structured hierarchy.

```typescript
await writeOutputArtifacts(result, '/tmp/validation-artifacts');
```

**Creates:**
```
outputDir/
  summary.txt                      # Human-readable summary
  validation-run.json              # Full machine-readable result
  scenarios/
    {scenario-id}/
      terminal.txt                 # Plain text (no ANSI)
      terminal-colored.txt         # With ANSI codes
      report.json                  # JSON envelope with metadata
      pr-comment.md                # GitHub markdown
```

## Types

All types are defined in `tools/validation/types.ts`:

- `ValidationScenario`: Input scenario definition
- `ScenarioOutput`: Single scenario rendered in all formats
- `ValidationRunResult`: Full validation run with summary

## Rendering Formats

Each scenario is rendered through 4 different formats:

1. **Terminal (Plain)**: `formatReport(report, { color: false })`
   - No ANSI color codes
   - Human-readable output for logs

2. **Terminal (Colored)**: `formatReport(report, { color: true })`
   - Full ANSI color codes
   - For terminal display

3. **JSON**: `createReportEnvelope(report)`
   - Pretty-printed with metadata envelope
   - Machine-readable with `_meta` section

4. **Markdown**: `renderMarkdown(report)`
   - GitHub-flavored markdown
   - Suitable for PR comments

## Test Coverage

**100% coverage** with 9 comprehensive tests:

- Single scenario processing through all renderers
- Multiple scenario aggregation with tag collection
- Summary statistics (total, passed, failed counts)
- File artifact creation and directory structure
- Edge cases (empty scenarios, ANSI code stripping)
- Failed check detection for verdict assignment

Run tests:
```bash
npx vitest run tools/validation/__tests__/runner.test.ts
```

## Implementation Details

### Immutability
- All functions use immutable patterns
- No mutations of input data
- Return new objects via object spread (`{ ...obj }`)

### Error Handling
- Graceful handling of JSON write/read failures
- Empty scenarios array returns proper result with zero counts
- All file I/O uses fs/promises for async safety

### Dependencies
- Uses native Node.js APIs: `fs/promises`, `path`, `os`
- No new npm dependencies required
- Integrates existing renderers: `terminalReporter`, `jsonLogger`, `ghPrCommenter`

## Usage Example

```typescript
import { runAllScenarios, writeOutputArtifacts } from './tools/validation/runner';
import { allScenarios } from './tools/validation/scenarios';

const result = await runAllScenarios(allScenarios, process.cwd());
await writeOutputArtifacts(result, './validation-output');

console.log(`Results: ${result.summary.passed}/${result.summary.total} passed`);
```

## File References

- **Implementation:** `/home/talha/dev/vector/tools/validation/runner.ts`
- **Types:** `/home/talha/dev/vector/tools/validation/types.ts`
- **Tests:** `/home/talha/dev/vector/tools/validation/__tests__/runner.test.ts`
- **Scenarios:** `/home/talha/dev/vector/tools/validation/scenarios/`
