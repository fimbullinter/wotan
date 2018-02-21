import { ConfigurationError } from './error';
import * as fs from 'fs';
import { GlobalOptions } from './types';

async function run() {
    try {
        const config = await loadConfig();
        const args = (await import('./argparse')).parseArguments(process.argv.slice(2), config);
        if (!await (await import('./commands')).runCommand(args, undefined, config))
            process.exitCode = 2;
    } catch (e) {
        console.error(e instanceof ConfigurationError ? e.message : e);
        process.exitCode = 1;
    }
}
function loadConfig() {
    return new Promise<GlobalOptions>((resolve, reject) => {
        return fs.readFile('.fimbullinter.yaml', {encoding: 'utf8'}, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT')
                    return resolve({});
                return reject(err);
            }
            return import('js-yaml').then((yaml) => {
                try {
                    return resolve(yaml.safeLoad(content, {strict: true}) || {});
                } catch (e) {
                    return reject(e);
                }
            });
        });
    });
}
if (process.argv.length === 3 && /^(')?(?:-v|version)\1$/.test(process.argv[2])) {
    console.log(require('../package.json').version); // tslint:disable-line:no-var-requires
} else {
    run();
}
