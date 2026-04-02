/**
 * CLI Runner — invokes the Vector CLI main() with process.argv.
 * Used for manual testing: npx ts-node tools/cli-runner.ts init --yes
 */
import { main } from '../src/cli/index';

main().then((code) => process.exit(code));
