import { ConfigurationError } from './error';

async function run() {
    try {
        const args = (await import('./argparse')).parseArguments(process.argv.slice(2));
        if (!await (await import('./commands')).runCommand(args))
            process.exitCode = 2;
    } catch (e) {
        console.error(e instanceof ConfigurationError ? e.message : e);
        process.exitCode = 1;
    }
}
if (process.argv.length === 3 && /^(')?(?:-[vV]|(?:--)?version)\1$/.test(process.argv[2])) {
    console.log(require('../package.json').version); // tslint:disable-line:no-require-imports
} else {
    run();
}
