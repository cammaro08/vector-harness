import { readFileSync } from 'fs';
import { load } from 'js-yaml';

export interface StepResult {
  stepName: string;
  type: 'deterministic' | 'agent';
  status: 'success' | 'failed' | 'skipped';
  attemptNumber: number;
  output?: unknown;
  error?: string;
  duration: number; // ms
}

export interface Escalation {
  reason: string;
  taskDescription: string;
  attemptHistory: StepResult[];
  suggestion: string;
}

export interface OrchestratorResult {
  blueprintName: string;
  success: boolean;
  completedSteps: StepResult[];
  failedStep?: string;
  escalation?: Escalation;
  totalDuration: number; // ms
}

export interface BlueprintStep {
  name: string;
  type: 'deterministic' | 'agent';
  retryable?: boolean;
  maxRetries?: number;
  condition?: string; // simple expression like "steps.run-tests.failed > 0"
  failureAction?: 'continue' | 'block';
  tool?: string;
  action?: string;
  agent?: string;
  description?: string;
}

export interface Blueprint {
  name: string;
  description: string;
  maxRetries: number;
  steps: BlueprintStep[];
}

export type StepExecutor = (
  step: BlueprintStep,
  context: Record<string, unknown>
) => Promise<{ success: boolean; output?: unknown; error?: string }>;

export interface OrchestratorOptions {
  blueprint: Blueprint;
  taskDescription: string;
  context?: Record<string, unknown>;
  executor: StepExecutor; // injected for testing
}

/**
 * Parse a condition string to extract step name, field, operator, and value
 */
function parseCondition(condition: string): {
  stepName: string;
  field: string;
  operator: string;
  value: number;
} | null {
  // Parse condition: "steps.<stepName>.<field> <operator> <value>"
  // Handle hyphens in step names
  const match = condition.match(/steps\.([a-zA-Z0-9\-_]+)\.([a-zA-Z0-9\-_]+)\s*(>|<|===|==|>=|<=)\s*(\d+)/);

  if (!match) {
    console.warn(`Could not parse condition: ${condition}`);
    return null;
  }

  return {
    stepName: match[1],
    field: match[2],
    operator: match[3],
    value: parseInt(match[4], 10)
  };
}

/**
 * Get a field value from step output
 */
function getFieldValue(stepResult: StepResult, field: string): number | null {
  if (!stepResult.output || typeof stepResult.output !== 'object') {
    return null;
  }

  const fieldValue = (stepResult.output as Record<string, unknown>)[field];
  if (typeof fieldValue === 'number') {
    return fieldValue;
  }

  const parsed = parseInt(String(fieldValue), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Compare actual value with target value using the given operator
 */
function compareValues(actual: number, operator: string, target: number): boolean {
  switch (operator) {
    case '>':
      return actual > target;
    case '<':
      return actual < target;
    case '>=':
      return actual >= target;
    case '<=':
      return actual <= target;
    case '==':
    case '===':
      return actual === target;
    default:
      return false;
  }
}

/**
 * Evaluates a condition string like "steps.run-tests.failed > 0"
 * Returns true if condition is true, false otherwise
 */
function evaluateCondition(
  condition: string,
  stepResults: Map<string, StepResult>
): boolean {
  const parsed = parseCondition(condition);
  if (!parsed) {
    return false;
  }

  const stepResult = stepResults.get(parsed.stepName);
  if (!stepResult) {
    return false;
  }

  const actualValue = getFieldValue(stepResult, parsed.field);
  if (actualValue === null) {
    return false;
  }

  return compareValues(actualValue, parsed.operator, parsed.value);
}

/**
 * Execute a single step with retry logic
 */
async function executeStepWithRetry(
  step: BlueprintStep,
  maxAttempts: number,
  executor: StepExecutor,
  context: Record<string, unknown>
): Promise<{
  result: StepResult;
  attemptHistory: StepResult[];
}> {
  const attemptHistory: StepResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const stepStartTime = Date.now();

    try {
      const result = await executor(step, context);
      const duration = Date.now() - stepStartTime;

      const stepResult: StepResult = {
        stepName: step.name,
        type: step.type,
        status: result.success ? 'success' : 'failed',
        attemptNumber: attempt,
        output: result.output,
        error: result.error,
        duration
      };

      attemptHistory.push(stepResult);

      if (result.success) {
        return { result: stepResult, attemptHistory };
      }

      // If this was the last attempt, return the failure
      if (attempt === maxAttempts) {
        return { result: stepResult, attemptHistory };
      }
    } catch (error) {
      const duration = Date.now() - stepStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const stepResult: StepResult = {
        stepName: step.name,
        type: step.type,
        status: 'failed',
        attemptNumber: attempt,
        error: errorMessage,
        duration
      };

      attemptHistory.push(stepResult);

      // If this was the last attempt, return the error
      if (attempt === maxAttempts) {
        return { result: stepResult, attemptHistory };
      }
    }
  }

  // This should never be reached, but return a safe result
  throw new Error(`Unexpected state in executeStepWithRetry for step ${step.name}`);
}

/**
 * Executes a blueprint orchestration with step retries and conditional logic
 */
export async function executeBlueprint(
  options: OrchestratorOptions
): Promise<OrchestratorResult> {
  const { blueprint, taskDescription, executor, context = {} } = options;
  const completedSteps: StepResult[] = [];
  const stepResultsMap = new Map<string, StepResult>();
  const startTime = Date.now();

  for (const step of blueprint.steps) {
    // Check if step should be skipped due to condition
    if (step.condition) {
      const shouldExecute = evaluateCondition(step.condition, stepResultsMap);

      if (!shouldExecute) {
        const stepResult: StepResult = {
          stepName: step.name,
          type: step.type,
          status: 'skipped',
          attemptNumber: 0,
          duration: 0
        };
        completedSteps.push(stepResult);
        stepResultsMap.set(step.name, stepResult);
        continue;
      }
    }

    // Determine retry behavior
    const { isRetryable, maxAttempts } = getRetryConfig(step, blueprint.maxRetries);

    // Execute step with retries
    const { result: stepResult, attemptHistory } = await executeStepWithRetry(
      step,
      maxAttempts,
      executor,
      context
    );

    completedSteps.push(stepResult);
    stepResultsMap.set(step.name, stepResult);

    // Handle step failure
    if (stepResult.status === 'failed') {
      if (step.failureAction === 'block') {
        // Escalate immediately - don't continue to next steps
        return {
          blueprintName: blueprint.name,
          success: false,
          completedSteps,
          failedStep: step.name,
          escalation: {
            reason: `Step '${step.name}' failed and has failureAction: 'block'`,
            taskDescription,
            attemptHistory,
            suggestion: `Review and manually fix '${step.name}'. ${
              step.type === 'agent'
                ? 'The agent encountered a persistent issue.'
                : 'The deterministic step failed.'
            }`
          },
          totalDuration: Date.now() - startTime
        };
      } else if (step.failureAction === 'continue') {
        // Continue to next step despite failure
        continue;
      } else {
        // No explicit failureAction and step failed - escalate
        return {
          blueprintName: blueprint.name,
          success: false,
          completedSteps,
          failedStep: step.name,
          escalation: createEscalation(
            step.name,
            step.type,
            stepResult.attemptNumber,
            taskDescription,
            attemptHistory,
            stepResult.error
          ),
          totalDuration: Date.now() - startTime
        };
      }
    }
  }

  return {
    blueprintName: blueprint.name,
    success: true,
    completedSteps,
    totalDuration: Date.now() - startTime
  };
}

/**
 * Determine retry configuration for a step
 */
function getRetryConfig(step: BlueprintStep, blueprintMaxRetries: number): {
  isRetryable: boolean;
  maxAttempts: number;
} {
  // If failureAction is explicitly set, don't retry (just execute once)
  const hasExplicitFailureAction = step.failureAction !== undefined;
  const isRetryable = hasExplicitFailureAction ? false : step.retryable !== false;
  const maxAttempts = isRetryable ? (step.maxRetries ?? blueprintMaxRetries) : 1;

  return { isRetryable, maxAttempts };
}

/**
 * Create a failure escalation object
 */
function createEscalation(
  stepName: string,
  stepType: 'deterministic' | 'agent',
  attemptNumber: number,
  taskDescription: string,
  attemptHistory: StepResult[],
  lastError?: string
): Escalation {
  const suggestion =
    stepType === 'agent'
      ? `Review '${stepName}' agent attempts and address the root cause. The agent encountered persistent issues after ${attemptNumber} attempts.`
      : `Review the deterministic step '${stepName}' and fix the underlying issue. ${
          lastError ? `Last error: ${lastError}` : ''
        }`;

  return {
    reason: `Step '${stepName}' failed after ${attemptNumber} attempt${attemptNumber > 1 ? 's' : ''}`,
    taskDescription,
    attemptHistory,
    suggestion
  };
}

/**
 * Loads a blueprint from a YAML file
 */
export function loadBlueprint(blueprintPath: string): Blueprint {
  const content = readFileSync(blueprintPath, 'utf-8');
  const data = load(content) as Record<string, unknown>;

  return data as Blueprint;
}
