import { ValidationScenario } from './types';

/**
 * Internal immutable registry of scenarios.
 * Using module-level state with immutable operations.
 */
let registeredScenarios: readonly ValidationScenario[] = [];

/**
 * Register a new validation scenario.
 * Throws if a scenario with the same ID already exists.
 * Creates a defensive copy to prevent external mutation.
 *
 * @param scenario The scenario to register
 * @throws Error if duplicate ID is detected
 */
export function registerScenario(scenario: ValidationScenario): void {
  // Check for duplicate ID
  if (registeredScenarios.some((s) => s.id === scenario.id)) {
    throw new Error(
      `Cannot register scenario: duplicate ID "${scenario.id}". Each scenario must have a unique ID.`
    );
  }

  // Create a defensive copy with frozen arrays and object
  const defensiveCopy = Object.freeze({
    id: scenario.id,
    description: scenario.description,
    tags: Object.freeze([...scenario.tags]),
    buildReport: scenario.buildReport,
  } as const) as ValidationScenario;

  // Add to registry using immutable spread
  registeredScenarios = [...registeredScenarios, defensiveCopy];
}

/**
 * Retrieve registered scenarios, optionally filtered by tags.
 *
 * @param filter Optional filter object with tags array (OR logic)
 * @returns A new array of matching scenarios
 */
export function getScenarios(filter?: { tags?: readonly string[] }): readonly ValidationScenario[] {
  if (!filter || !filter.tags || filter.tags.length === 0) {
    // Return all scenarios as a new array (immutable)
    return [...registeredScenarios];
  }

  // Filter scenarios that have at least one matching tag
  return registeredScenarios.filter((scenario) =>
    scenario.tags.some((tag) => filter.tags!.includes(tag))
  );
}

/**
 * Get all unique tags across all registered scenarios.
 *
 * @returns A new array of unique tags
 */
export function getAllTags(): readonly string[] {
  // Collect all tags and deduplicate
  const tagsSet = new Set<string>();

  for (const scenario of registeredScenarios) {
    for (const tag of scenario.tags) {
      tagsSet.add(tag);
    }
  }

  // Return as a new array
  return Array.from(tagsSet);
}

/**
 * Clear all registered scenarios (useful for testing).
 * Not exported as part of the public API.
 */
export function clearScenarios(): void {
  registeredScenarios = [];
}
