import { parseArguments } from './argparse';
import { run } from './runner';

const args = parseArguments(process.argv.slice(2));
if (run(args))
    process.exitCode = 2;
