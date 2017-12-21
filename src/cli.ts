import { parseArguments } from './argparse';
import { runCommand } from './commands';
import { ConfigurationError } from './error';

async function run() {
    try {
        const args = parseArguments(process.argv.slice(2));
        if (!await runCommand(args))
            process.exitCode = 2;
    } catch (e) {
        console.error(e instanceof ConfigurationError ? e.message : e);
        process.exitCode = 1;
    }
}
run();
