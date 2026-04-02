import { multiselect, isCancel, log } from '@clack/prompts';

/**
 * Option for searchable multiselect.
 */
export interface SearchMultiselectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Configuration for searchable multiselect prompt.
 */
export interface SearchMultiselectConfig {
  message: string;
  options: SearchMultiselectOption[];
  locked?: SearchMultiselectOption[];
  initialValues?: string[];
}

/**
 * Result from searchable multiselect.
 */
export interface SearchMultiselectResult {
  selected: string[];
  locked: string[];
  all: string[];
  cancelled: boolean;
}

/**
 * Filters options by case-insensitive substring match on label and value.
 * Returns all options if search is empty or whitespace only.
 *
 * @param options - Array of options to filter
 * @param search - Search term (case-insensitive)
 * @returns Filtered options preserving original order
 */
export function filterOptions(
  options: SearchMultiselectOption[],
  search: string
): SearchMultiselectOption[] {
  const trimmedSearch = search.trim();

  // Return all options if search is empty
  if (!trimmedSearch) {
    return options;
  }

  const lowerSearch = trimmedSearch.toLowerCase();

  // Filter by substring match on label or value
  return options.filter((option) => {
    const lowerLabel = option.label.toLowerCase();
    const lowerValue = option.value.toLowerCase();

    return lowerLabel.includes(lowerSearch) || lowerValue.includes(lowerSearch);
  });
}

/**
 * Displays a searchable multiselect prompt.
 * Wraps @clack/prompts multiselect with support for locked items.
 *
 * In interactive mode: Shows multiselect with locked items displayed above.
 * In non-interactive mode: Returns all options as selected.
 *
 * @param config - Configuration object
 * @returns Result with selected, locked, all, and cancelled flag
 */
export async function searchMultiselect(
  config: SearchMultiselectConfig
): Promise<SearchMultiselectResult> {
  const { message, options, locked = [], initialValues } = config;

  // Extract locked values
  const lockedValues = locked.map((item) => item.value);

  // Display locked items info if any exist
  if (locked.length > 0) {
    const lockedLabels = locked.map((item) => `  • ${item.label}`).join('\n');
    log.info(`Locked selections:\n${lockedLabels}`);
  }

  // Convert options to multiselect format
  const multiselectOptions = options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    hint: opt.hint,
  }));

  // Call multiselect prompt
  const result = await multiselect({
    message,
    options: multiselectOptions,
    initialValues,
  });

  // Check for cancellation
  if (isCancel(result)) {
    return {
      selected: [],
      locked: lockedValues,
      all: lockedValues,
      cancelled: true,
    };
  }

  // Combine locked and selected values
  const allValues = [...lockedValues, ...result];

  return {
    selected: result,
    locked: lockedValues,
    all: allValues,
    cancelled: false,
  };
}
