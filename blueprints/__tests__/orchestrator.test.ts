import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeBlueprint,
  loadBlueprint,
  type Blueprint,
  type BlueprintStep,
  type StepResult,
  type OrchestratorResult,
  type OrchestratorOptions,
  type StepExecutor
} from '../orchestrator';
import { join } from 'path';

describe('Blueprint Orchestrator', () => {
  let mockExecutor: StepExecutor;

  beforeEach(() => {
    mockExecutor = vi.fn();
  });

  describe('executeBlueprint', () => {
    it('executes all steps in order when all succeed', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'step1', type: 'deterministic' },
          { name: 'step2', type: 'agent' },
          { name: 'step3', type: 'deterministic' }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true, output: 'done' });

      const options: OrchestratorOptions = {
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      };

      const result = await executeBlueprint(options);

      expect(mockExecutor).toHaveBeenCalledTimes(3);
      expect(mockExecutor).toHaveBeenNthCalledWith(1, blueprint.steps[0], expect.any(Object));
      expect(mockExecutor).toHaveBeenNthCalledWith(2, blueprint.steps[1], expect.any(Object));
      expect(mockExecutor).toHaveBeenNthCalledWith(3, blueprint.steps[2], expect.any(Object));
    });

    it('returns success:true when all steps pass', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'step1', type: 'deterministic' },
          { name: 'step2', type: 'agent' }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(result.success).toBe(true);
      expect(result.blueprintName).toBe('Test Blueprint');
      expect(result.failedStep).toBeUndefined();
      expect(result.escalation).toBeUndefined();
    });

    it('retries a failing step up to maxRetries times', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'flaky-step', type: 'deterministic', retryable: true, maxRetries: 3 }
        ]
      };

      // Fail twice, then succeed
      mockExecutor
        .mockResolvedValueOnce({ success: false, error: 'First failure' })
        .mockResolvedValueOnce({ success: false, error: 'Second failure' })
        .mockResolvedValueOnce({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(mockExecutor).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(1);
      expect(result.completedSteps[0].status).toBe('success');
      expect(result.completedSteps[0].attemptNumber).toBe(3);
    });

    it('returns success:false and failedStep after max retries exceeded', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'failing-step', type: 'deterministic', retryable: true, maxRetries: 3 }
        ]
      };

      mockExecutor.mockResolvedValue({ success: false, error: 'Persistent failure' });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('failing-step');
      expect(mockExecutor).toHaveBeenCalledTimes(3); // max retries
    });

    it('creates escalation object after max retries with attempt history', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'failing-step', type: 'agent', retryable: true, maxRetries: 3 }
        ]
      };

      mockExecutor.mockResolvedValue({ success: false, error: 'Agent failed' });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Fix this critical issue',
        executor: mockExecutor
      });

      expect(result.escalation).toBeDefined();
      expect(result.escalation!.reason).toContain('failing-step');
      expect(result.escalation!.taskDescription).toBe('Fix this critical issue');
      expect(result.escalation!.attemptHistory).toHaveLength(3);
      expect(result.escalation!.attemptHistory[0].attemptNumber).toBe(1);
      expect(result.escalation!.attemptHistory[2].attemptNumber).toBe(3);
      expect(result.escalation!.suggestion).toBeDefined();
    });

    it('skips a conditional step when condition is false', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'run-tests', type: 'deterministic' },
          { name: 'fix-tests', type: 'agent', condition: 'steps.run-tests.failed > 0' }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true, output: { failed: 0 } });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      expect(mockExecutor).toHaveBeenCalledTimes(1); // Only first step executed
      const stepResults = result.completedSteps;
      expect(stepResults).toHaveLength(2);
      expect(stepResults[1].status).toBe('skipped');
    });

    it('executes a conditional step when condition is true', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          {
            name: 'run-tests',
            type: 'deterministic',
            tool: 'testRunner'
          },
          {
            name: 'fix-tests',
            type: 'agent',
            agent: 'test-fixer',
            condition: 'steps.run-tests.failed > 0'
          }
        ]
      };

      // First call returns test failure
      mockExecutor
        .mockResolvedValueOnce({ success: true, output: { failed: 2 } })
        .mockResolvedValueOnce({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      expect(mockExecutor).toHaveBeenCalledTimes(2);
      const stepResults = result.completedSteps;
      expect(stepResults).toHaveLength(2);
      expect(stepResults[1].status).toBe('success');
    });

    it('continues execution when failureAction is continue', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'step1', type: 'deterministic', failureAction: 'continue' },
          { name: 'step2', type: 'deterministic' }
        ]
      };

      mockExecutor
        .mockResolvedValueOnce({ success: false, error: 'Step 1 failed' })
        .mockResolvedValueOnce({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(mockExecutor).toHaveBeenCalledTimes(2);
      expect(result.completedSteps).toHaveLength(2);
      expect(result.completedSteps[0].status).toBe('failed');
      expect(result.completedSteps[1].status).toBe('success');
    });

    it('blocks execution when failureAction is block and step fails', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'step1', type: 'deterministic', failureAction: 'block' },
          { name: 'step2', type: 'deterministic' }
        ]
      };

      mockExecutor
        .mockResolvedValueOnce({ success: false, error: 'Blocking failure' })
        .mockResolvedValueOnce({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(mockExecutor).toHaveBeenCalledTimes(1); // Only first step
      expect(result.success).toBe(false);
      expect(result.failedStep).toBe('step1');
      expect(result.completedSteps).toHaveLength(1);
    });

    it('tracks duration for each step', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [{ name: 'step1', type: 'deterministic' }]
      };

      mockExecutor.mockResolvedValue({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(result.completedSteps[0].duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.completedSteps[0].duration).toBe('number');
    });

    it('has correct stepName, type, and status in StepResult', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [{ name: 'my-step', type: 'agent' }]
      };

      mockExecutor.mockResolvedValue({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      const stepResult = result.completedSteps[0];
      expect(stepResult.stepName).toBe('my-step');
      expect(stepResult.type).toBe('agent');
      expect(stepResult.status).toBe('success');
      expect(stepResult.attemptNumber).toBe(1);
    });

    it('tracks total duration for the entire orchestration', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'step1', type: 'deterministic' },
          { name: 'step2', type: 'deterministic' }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(typeof result.totalDuration).toBe('number');
    });

    it('does not retry non-retryable steps', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'non-retryable', type: 'deterministic', retryable: false }
        ]
      };

      mockExecutor.mockResolvedValue({ success: false, error: 'Failed' });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(result.failedStep).toBe('non-retryable');
    });

    it('passes context to executor for condition evaluation', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          {
            name: 'first',
            type: 'deterministic'
          },
          {
            name: 'conditional',
            type: 'deterministic',
            condition: 'steps.first.failed > 0'
          }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true, output: { failed: 0 } });

      const context = { someKey: 'someValue' };
      await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context
      });

      // Verify context was passed
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining(context)
      );
    });

    it('handles step with custom maxRetries different from blueprint maxRetries', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'custom-retry', type: 'deterministic', retryable: true, maxRetries: 2 }
        ]
      };

      mockExecutor.mockResolvedValue({ success: false, error: 'Failed' });

      await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      // Should retry 2 times (maxRetries: 2 on step, not 3 from blueprint)
      expect(mockExecutor).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadBlueprint', () => {
    it('parses YAML correctly and returns Blueprint object', async () => {
      const blueprintPath = join(__dirname, '../../blueprints/implement-feature.yaml');

      const blueprint = loadBlueprint(blueprintPath);

      expect(blueprint.name).toBe('Implement Feature');
      expect(blueprint.description).toBe('Full feature implementation workflow with per-step retry');
      expect(blueprint.maxRetries).toBe(3);
      expect(blueprint.steps).toBeDefined();
      expect(blueprint.steps.length).toBeGreaterThan(0);

      const firstStep = blueprint.steps[0];
      expect(firstStep.name).toBe('setup');
      expect(firstStep.type).toBe('deterministic');
    });

    it('loads fix-bug blueprint correctly', () => {
      const blueprintPath = join(__dirname, '../../blueprints/fix-bug.yaml');

      const blueprint = loadBlueprint(blueprintPath);

      expect(blueprint.name).toBe('Fix Bug');
      expect(blueprint.steps).toBeDefined();
      expect(blueprint.steps.length).toBeGreaterThan(0);
    });

    it('loads refactor blueprint correctly', () => {
      const blueprintPath = join(__dirname, '../../blueprints/refactor.yaml');

      const blueprint = loadBlueprint(blueprintPath);

      expect(blueprint.name).toBe('Refactor');
      expect(blueprint.steps).toBeDefined();
      expect(blueprint.steps.length).toBeGreaterThan(0);
    });

    it('preserves all step properties from YAML', () => {
      const blueprintPath = join(__dirname, '../../blueprints/implement-feature.yaml');

      const blueprint = loadBlueprint(blueprintPath);

      const fixFailuresStep = blueprint.steps.find(s => s.name === 'fix-failures');
      expect(fixFailuresStep).toBeDefined();
      expect(fixFailuresStep!.type).toBe('agent');
      expect(fixFailuresStep!.agent).toBe('test-fixer');
      expect(fixFailuresStep!.condition).toBe('steps.run-tests.failed > 0');
      expect(fixFailuresStep!.retryable).toBe(true);
      expect(fixFailuresStep!.maxRetries).toBe(3);
    });
  });

  describe('Escalation scenarios', () => {
    it('includes attempt history with all attempts when escalating', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'failing-step', type: 'agent', retryable: true, maxRetries: 3 }
        ]
      };

      const errors = ['Error 1', 'Error 2', 'Error 3'];
      mockExecutor
        .mockResolvedValueOnce({ success: false, error: errors[0] })
        .mockResolvedValueOnce({ success: false, error: errors[1] })
        .mockResolvedValueOnce({ success: false, error: errors[2] });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Critical task',
        executor: mockExecutor
      });

      expect(result.escalation!.attemptHistory).toHaveLength(3);
      expect(result.escalation!.attemptHistory[0].error).toBe(errors[0]);
      expect(result.escalation!.attemptHistory[1].error).toBe(errors[1]);
      expect(result.escalation!.attemptHistory[2].error).toBe(errors[2]);
    });

    it('includes suggestion in escalation object', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'agent-step', type: 'agent', retryable: true, maxRetries: 2 }
        ]
      };

      mockExecutor.mockResolvedValue({ success: false, error: 'Task failed' });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Implement new feature',
        executor: mockExecutor
      });

      expect(result.escalation!.suggestion).toMatch(/agent-step/i);
    });
  });

  describe('Edge cases', () => {
    it('handles empty steps array', async () => {
      const blueprint: Blueprint = {
        name: 'Empty Blueprint',
        description: 'No steps',
        maxRetries: 3,
        steps: []
      };

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toHaveLength(0);
    });

    it('handles step with no executor output', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [{ name: 'step1', type: 'deterministic' }]
      };

      mockExecutor.mockResolvedValue({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor
      });

      expect(result.completedSteps[0].output).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it('evaluates complex conditions with multiple comparisons', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          {
            name: 'test-run',
            type: 'deterministic'
          },
          {
            name: 'fix-critical',
            type: 'agent',
            condition: 'steps.test-run.failed > 2'
          }
        ]
      };

      // When failed = 2, condition is false (not > 2)
      mockExecutor.mockResolvedValue({ success: true, output: { failed: 2 } });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      expect(result.completedSteps[1].status).toBe('skipped');

      // Reset mocks
      vi.clearAllMocks();
      mockExecutor.mockResolvedValue({ success: true, output: { failed: 3 } });

      const result2 = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      expect(result2.completedSteps[1].status).toBe('success');
    });

    it('handles all comparison operators in conditions', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'baseline', type: 'deterministic' },
          { name: 'less-than', type: 'deterministic', condition: 'steps.baseline.value < 5' },
          { name: 'less-equal', type: 'deterministic', condition: 'steps.baseline.value <= 5' },
          { name: 'greater-equal', type: 'deterministic', condition: 'steps.baseline.value >= 5' },
          { name: 'equal', type: 'deterministic', condition: 'steps.baseline.value == 5' }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true, output: { value: 5 } });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      expect(result.completedSteps[1].status).toBe('skipped'); // < 5 is false
      expect(result.completedSteps[2].status).toBe('success'); // <= 5 is true
      expect(result.completedSteps[3].status).toBe('success'); // >= 5 is true
      expect(result.completedSteps[4].status).toBe('success'); // == 5 is true
    });

    it('handles condition with non-numeric field value', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          {
            name: 'run',
            type: 'deterministic'
          },
          {
            name: 'conditional',
            type: 'deterministic',
            condition: 'steps.run.count > 0'
          }
        ]
      };

      // Output with non-numeric field that can't be parsed
      mockExecutor.mockResolvedValue({ success: true, output: { count: 'abc' } });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      // Should skip because field can't be evaluated
      expect(result.completedSteps[1].status).toBe('skipped');
    });

    it('handles condition referencing non-existent step', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          {
            name: 'step1',
            type: 'deterministic',
            condition: 'steps.non-existent.value > 0'
          }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      // Should skip because referenced step doesn't exist
      expect(result.completedSteps[0].status).toBe('skipped');
    });

    it('throws on invalid condition format', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          {
            name: 'step1',
            type: 'deterministic',
            condition: 'invalid-condition-format'
          }
        ]
      };

      mockExecutor.mockResolvedValue({ success: true });

      // Should throw error on unparseable condition
      await expect(executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      })).rejects.toThrow('Invalid condition expression');
    });

    it('handles field value as string that parses to number', async () => {
      const blueprint: Blueprint = {
        name: 'Test Blueprint',
        description: 'Test',
        maxRetries: 3,
        steps: [
          { name: 'run', type: 'deterministic' },
          { name: 'conditional', type: 'deterministic', condition: 'steps.run.count > 2' }
        ]
      };

      // Output with field as string that can be parsed to number
      mockExecutor.mockResolvedValue({ success: true, output: { count: '5' } });

      const result = await executeBlueprint({
        blueprint,
        taskDescription: 'Test task',
        executor: mockExecutor,
        context: {}
      });

      expect(result.completedSteps[1].status).toBe('success'); // '5' > 2 is true
    });
  });
});
