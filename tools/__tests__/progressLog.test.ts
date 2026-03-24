import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logProgress, LogOptions, LogResult, EventType } from '../progressLog';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import * as fs from 'fs/promises';

const mockFs = fs as any;

describe('progressLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logProgress function', () => {
    it('should create PROGRESS_LOG.md with header and table header if it does not exist', async () => {
      const cwd = '/test/project';
      const filePath = `${cwd}/docs/PROGRESS_LOG.md`;

      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options: LogOptions = {
        cwd,
        eventType: 'START_TASK',
        stepName: 'implement-feature',
        attemptNumber: 1,
        agentName: 'implementer',
        message: 'Starting feature implementation',
      };

      const result = await logProgress(options);

      expect(mockFs.mkdir).toHaveBeenCalledWith(`${cwd}/docs`, { recursive: true });

      const writeFileCall = mockFs.writeFile.mock.calls[0];
      expect(writeFileCall[0]).toBe(filePath);

      const content = writeFileCall[1];
      expect(content).toContain('# Progress Log');
      expect(content).toContain('| Timestamp | Event | Step | Attempt | Agent | Message |');
      expect(content).toContain('|-----------|-------|------|---------|-------|---------|');

      expect(result.logged).toBe(true);
      expect(result.filePath).toBe(filePath);
    });

    it('should append a new row to existing PROGRESS_LOG.md', async () => {
      const cwd = '/test/project';
      const filePath = `${cwd}/docs/PROGRESS_LOG.md`;
      const existingContent = `# Progress Log

| Timestamp | Event | Step | Attempt | Agent | Message |
|-----------|-------|------|---------|-------|---------|
| 2026-03-23T10:00:00.000Z | START_TASK | previous-task | 1 | agent-1 | Previous task |
`;

      mockFs.readFile.mockResolvedValueOnce(existingContent);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options: LogOptions = {
        cwd,
        eventType: 'ATTEMPT',
        stepName: 'write-tests',
        attemptNumber: 1,
        agentName: 'tdd-agent',
        message: 'Writing tests for user endpoint',
      };

      await logProgress(options);

      const writeFileCall = mockFs.writeFile.mock.calls[0];
      const newContent = writeFileCall[1];

      expect(newContent).toContain('# Progress Log');
      expect(newContent).toContain('previous-task');
      expect(newContent).toContain('write-tests');
      expect(newContent).toContain('ATTEMPT');
      expect(newContent).toContain('tdd-agent');
      expect(newContent).toContain('Writing tests for user endpoint');
    });

    it('should return LogResult with logged=true and entry', async () => {
      const cwd = '/test/project';
      const filePath = `${cwd}/docs/PROGRESS_LOG.md`;

      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options: LogOptions = {
        cwd,
        eventType: 'SUCCEED',
        stepName: 'test-step',
        attemptNumber: 2,
        agentName: 'my-agent',
        message: 'All tests passed',
      };

      const result = await logProgress(options);

      expect(result).toHaveProperty('logged');
      expect(result.logged).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(result.filePath).toBe(filePath);
      expect(result).toHaveProperty('entry');
      expect(result.entry.stepName).toBe('test-step');
      expect(result.entry.agentName).toBe('my-agent');
      expect(result.entry.message).toBe('All tests passed');
    });

    it('should format timestamp as ISO 8601', async () => {
      const cwd = '/test/project';
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options: LogOptions = {
        cwd,
        eventType: 'START_TASK',
        stepName: 'feature',
        attemptNumber: 1,
        agentName: 'test-agent',
        message: 'Starting',
      };

      const result = await logProgress(options);

      expect(result.entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle all EventType values', async () => {
      const eventTypes: EventType[] = ['START_TASK', 'ATTEMPT', 'FAIL', 'SUCCEED', 'ESCALATE'];

      for (const eventType of eventTypes) {
        vi.clearAllMocks();

        mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
        mockFs.mkdir.mockResolvedValueOnce(undefined);
        mockFs.writeFile.mockResolvedValueOnce(undefined);

        const options: LogOptions = {
          cwd: '/test/project',
          eventType,
          stepName: 'test-step',
          attemptNumber: 1,
          agentName: 'agent',
          message: 'Test message',
        };

        const result = await logProgress(options);

        expect(result.entry.eventType).toBe(eventType);
      }
    });

    it('should create docs/ directory if it does not exist', async () => {
      const cwd = '/test/project';

      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options: LogOptions = {
        cwd,
        eventType: 'START_TASK',
        stepName: 'step',
        attemptNumber: 1,
        agentName: 'agent',
        message: 'Message',
      };

      await logProgress(options);

      expect(mockFs.mkdir).toHaveBeenCalledWith(`${cwd}/docs`, { recursive: true });
    });

    it('should append metadata as JSON code block when present', async () => {
      const cwd = '/test/project';
      const filePath = `${cwd}/docs/PROGRESS_LOG.md`;

      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const metadata = {
        userId: 'user-123',
        duration: 45.2,
        details: {
          nested: 'value',
        },
      };

      const options: LogOptions = {
        cwd,
        eventType: 'SUCCEED',
        stepName: 'deploy',
        attemptNumber: 1,
        agentName: 'deployer',
        message: 'Deployment succeeded',
        metadata,
      };

      const result = await logProgress(options);

      const writeFileCall = mockFs.writeFile.mock.calls[0];
      const content = writeFileCall[1];

      expect(content).toContain('```json');
      expect(content).toContain('"userId": "user-123"');
      expect(content).toContain('"duration": 45.2');
      expect(content).toContain('"nested": "value"');
      expect(content).toContain('```');

      expect(result.entry.metadata).toEqual(metadata);
    });

    it('should support multiple appends without overwriting', async () => {
      const cwd = '/test/project';
      const filePath = `${cwd}/docs/PROGRESS_LOG.md`;

      // First call - file doesn't exist
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options1: LogOptions = {
        cwd,
        eventType: 'START_TASK',
        stepName: 'step-1',
        attemptNumber: 1,
        agentName: 'agent-1',
        message: 'First message',
      };

      await logProgress(options1);

      // Simulate the file now existing with the previous content
      const firstContent = (mockFs.writeFile.mock.calls[0] as any)[1];

      // Second call - file exists
      vi.clearAllMocks();
      mockFs.readFile.mockResolvedValueOnce(firstContent);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options2: LogOptions = {
        cwd,
        eventType: 'ATTEMPT',
        stepName: 'step-2',
        attemptNumber: 2,
        agentName: 'agent-2',
        message: 'Second message',
      };

      await logProgress(options2);

      const secondContent = (mockFs.writeFile.mock.calls[0] as any)[1];

      expect(secondContent).toContain('step-1');
      expect(secondContent).toContain('step-2');
      expect(secondContent).toContain('First message');
      expect(secondContent).toContain('Second message');
    });

    it('should not include metadata in LogResult when not provided', async () => {
      const cwd = '/test/project';

      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const options: LogOptions = {
        cwd,
        eventType: 'START_TASK',
        stepName: 'step',
        attemptNumber: 1,
        agentName: 'agent',
        message: 'Message',
      };

      const result = await logProgress(options);

      expect(result.entry.metadata).toBeUndefined();
    });
  });
});
