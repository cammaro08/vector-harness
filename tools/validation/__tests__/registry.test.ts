import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationScenario } from '../types';
import { registerScenario, getScenarios, getAllTags, clearScenarios } from '../registry';
import { createReport } from '../../enforcementReport';

describe('ValidationRegistry', () => {
  beforeEach(() => {
    // Clear all scenarios before each test
    clearScenarios();
  });

  describe('registerScenario', () => {
    it('should register a scenario', () => {
      const scenario: ValidationScenario = {
        id: 'test-scenario',
        description: 'A test scenario',
        tags: ['pass'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario);
      const scenarios = getScenarios();

      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].id).toBe('test-scenario');
    });

    it('should reject duplicate scenario IDs', () => {
      const scenario: ValidationScenario = {
        id: 'duplicate-id',
        description: 'First scenario',
        tags: ['pass'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario);

      const duplicateScenario: ValidationScenario = {
        id: 'duplicate-id',
        description: 'Second scenario with same ID',
        tags: ['fail'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-2',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      expect(() => registerScenario(duplicateScenario)).toThrow(
        /duplicate.*duplicate-id/i
      );
    });

    it('should not mutate the input scenario', () => {
      const scenario: ValidationScenario = {
        id: 'immutable-test',
        description: 'Test immutability',
        tags: ['pass'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario);

      // Try to mutate the original
      (scenario as any).id = 'modified-id';

      // Verify the registered scenario still has the original ID
      const scenarios = getScenarios();
      expect(scenarios[0].id).toBe('immutable-test');
    });
  });

  describe('getScenarios', () => {
    it('should return all registered scenarios', () => {
      const scenario1: ValidationScenario = {
        id: 'scenario-1',
        description: 'First',
        tags: ['pass'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      const scenario2: ValidationScenario = {
        id: 'scenario-2',
        description: 'Second',
        tags: ['retry'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-2',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario1);
      registerScenario(scenario2);

      const scenarios = getScenarios();

      expect(scenarios).toHaveLength(2);
      expect(scenarios.map((s) => s.id)).toEqual(['scenario-1', 'scenario-2']);
    });

    it('should return empty array when no scenarios registered', () => {
      const scenarios = getScenarios();
      expect(scenarios).toEqual([]);
    });

    it('should filter scenarios by single tag', () => {
      const passingScenario: ValidationScenario = {
        id: 'pass-scenario',
        description: 'Passing test',
        tags: ['pass'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      const failingScenario: ValidationScenario = {
        id: 'fail-scenario',
        description: 'Failing test',
        tags: ['fail'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-2',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(passingScenario);
      registerScenario(failingScenario);

      const passScenarios = getScenarios({ tags: ['pass'] });

      expect(passScenarios).toHaveLength(1);
      expect(passScenarios[0].id).toBe('pass-scenario');
    });

    it('should filter scenarios by multiple tags (OR logic)', () => {
      const scenario1: ValidationScenario = {
        id: 'scenario-1',
        description: 'Has pass tag',
        tags: ['pass'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      const scenario2: ValidationScenario = {
        id: 'scenario-2',
        description: 'Has retry tag',
        tags: ['retry'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-2',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      const scenario3: ValidationScenario = {
        id: 'scenario-3',
        description: 'Has fail tag',
        tags: ['fail'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-3',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario1);
      registerScenario(scenario2);
      registerScenario(scenario3);

      const filtered = getScenarios({ tags: ['pass', 'retry'] });

      expect(filtered).toHaveLength(2);
      expect(filtered.map((s) => s.id)).toEqual(['scenario-1', 'scenario-2']);
    });

    it('should return scenarios with multiple tags when one matches', () => {
      const scenario: ValidationScenario = {
        id: 'multi-tag',
        description: 'Has multiple tags',
        tags: ['pass', 'retry', 'edge-case'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario);

      const filtered = getScenarios({ tags: ['retry'] });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('multi-tag');
    });

    it('should not return the same scenario object when no filter', () => {
      const scenario: ValidationScenario = {
        id: 'scenario-1',
        description: 'Test',
        tags: ['pass'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario);

      const scenarios1 = getScenarios();
      const scenarios2 = getScenarios();

      expect(scenarios1).not.toBe(scenarios2);
      expect(scenarios1).toEqual(scenarios2);
    });
  });

  describe('getAllTags', () => {
    it('should return unique tags across all scenarios', () => {
      const scenario1: ValidationScenario = {
        id: 'scenario-1',
        description: 'First',
        tags: ['pass', 'quick'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-1',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      const scenario2: ValidationScenario = {
        id: 'scenario-2',
        description: 'Second',
        tags: ['retry', 'quick'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-2',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      const scenario3: ValidationScenario = {
        id: 'scenario-3',
        description: 'Third',
        tags: ['fail'],
        buildReport: (cwd: string) =>
          createReport({
            id: 'test-3',
            blueprintName: 'Test',
            taskDescription: 'Test',
            cwd,
          }),
      };

      registerScenario(scenario1);
      registerScenario(scenario2);
      registerScenario(scenario3);

      const tags = getAllTags();

      expect(tags).toHaveLength(4);
      expect(Array.from(tags).sort()).toEqual(['fail', 'pass', 'quick', 'retry']);
    });

    it('should return empty array when no scenarios registered', () => {
      const tags = getAllTags();
      expect(tags).toEqual([]);
    });

  });
});
