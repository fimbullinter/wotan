import { parseArguments } from './argparse';
import { run } from './commands';
import { ConfigurationError } from './error';

try {
    const args = parseArguments(process.argv.slice(2));
    if (!run(args))
        process.exitCode = 2;
} catch (e) {
    if (!(e instanceof ConfigurationError))
        throw e;
    console.error(e.message);
    process.exitCode = 1;
}
