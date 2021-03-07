import { ConfigurationError, GlobalOptions } from '@fimbul/ymir';
import * as fs from 'fs';
import * as path from 'path';
import debug = require('debug');

const log = debug('wotan:cli');

export async function run(argv: string[]) {
    if (argv.length === 1 && /^(')?-(?:v|-version)\1$/.test(argv[0]))
        return console.log(require('../package.json').version);
    try {
        const config = await loadConfig('.');
        const args = (await import('./argparse')).parseArguments(argv, config);
        if (!await (await import('./commands')).runCommand(args, undefined, config))
            process.exitCode = 2;
    } catch (e) {
        console.error(e instanceof ConfigurationError ? e.message : e);
        process.exitCode = 1;
    }
}
export function loadConfig(dir: string) {
    const fileName = path.join(dir, '.fimbullinter.yaml');
    return new Promise<GlobalOptions>((resolve) => {
        return fs.readFile(fileName, {encoding: 'utf8'}, (err, content) => {
            if (err) {
                log("Not using '%s': %s", fileName, err.code);
                return resolve({});
            }
            import('js-yaml').then((yaml) => {
                try {
                    resolve(<GlobalOptions | undefined>yaml.load(content) || {});
                    log("Using global options from '%s'", fileName);
                } catch (e) {
                    log("Not using '%s': %s", fileName, e?.message);
                    resolve({});
                }
            });
        });
    });
}

if (require.main === module) {
    log('CLI arguments: %O', process.argv);
    run(process.argv.slice(2));
}
