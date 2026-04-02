/**
 * CLI Banner Module
 *
 * Provides ASCII art banner and styled output for the Vector CLI.
 */

const picocolors = require('picocolors');

/**
 * ASCII art VECTOR logo using block characters
 */
export const BANNER = `
██╗   ██╗███████╗ ██████╗████████╗ ██████╗ ██████╗
██║   ██║██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
██║   ██║█████╗  ██║        ██║   ██║   ██║██████╔╝
╚██╗ ██╔╝██╔══╝  ██║        ██║   ██║   ██║██╔══██╗
 ╚████╔╝ ███████╗╚██████╗   ██║   ╚██████╔╝██║  ██║
  ╚══╝   ╚══════╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
`.trim();

/**
 * Render the banner with optional color styling
 *
 * @param options - Configuration object
 * @param options.color - Whether to apply color styling (default: true)
 * @returns Formatted banner string with tagline and version
 */
export function renderBanner(options?: { color?: boolean }): string {
  const shouldColor = options?.color !== false; // Default to true

  // Get version from package.json
  const pkg = require('../../package.json');
  const version = pkg.version;

  // Tagline
  const tagline = 'Configurable enforcement checks for AI coding agents';

  // Build the output
  let output = BANNER + '\n\n';

  if (shouldColor) {
    output += picocolors.cyan(tagline) + '\n';
    output += picocolors.dim(`v${version}`) + '\n';
  } else {
    output += tagline + '\n';
    output += `v${version}\n`;
  }

  return output;
}

/**
 * Display the banner to stdout
 *
 * @param options - Configuration object
 * @param options.color - Whether to apply color styling (default: true)
 */
export function showBanner(options?: { color?: boolean }): void {
  console.log(renderBanner(options));
}
