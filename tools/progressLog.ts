import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export type EventType = 'START_TASK' | 'ATTEMPT' | 'FAIL' | 'SUCCEED' | 'ESCALATE';

export interface LogEntry {
  timestamp: string;
  eventType: EventType;
  stepName: string;
  attemptNumber: number;
  agentName: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LogOptions {
  cwd: string;
  eventType: EventType;
  stepName: string;
  attemptNumber: number;
  agentName: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LogResult {
  logged: boolean;
  filePath: string;
  entry: LogEntry;
}

function formatHeader(): string {
  return `# Progress Log

| Timestamp | Event | Step | Attempt | Agent | Message |
|-----------|-------|------|---------|-------|---------|`;
}

function formatRow(entry: LogEntry): string {
  return `| ${entry.timestamp} | ${entry.eventType} | ${entry.stepName} | ${entry.attemptNumber} | ${entry.agentName} | ${entry.message} |`;
}

function formatMetadata(metadata: Record<string, unknown>): string {
  return `\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\``;
}

export async function logProgress(options: LogOptions): Promise<LogResult> {
  const { cwd, eventType, stepName, attemptNumber, agentName, message, metadata } = options;
  const docsDir = join(cwd, 'docs');
  const filePath = join(docsDir, 'PROGRESS_LOG.md');

  // Create docs directory if it doesn't exist
  await mkdir(docsDir, { recursive: true });

  // Create log entry with current timestamp
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    stepName,
    attemptNumber,
    agentName,
    message,
    metadata,
  };

  // Read existing content or create new header
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    // File doesn't exist, start with header
    content = formatHeader();
  }

  // Format and append new row
  const row = formatRow(entry);
  let newContent = content + '\n' + row;

  // Append metadata as JSON block if present
  if (metadata) {
    newContent += formatMetadata(metadata);
  }

  // Write updated content to file
  await writeFile(filePath, newContent, 'utf-8');

  return {
    logged: true,
    filePath,
    entry,
  };
}
