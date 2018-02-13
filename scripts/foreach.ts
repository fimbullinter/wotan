import * as glob from 'glob';
import * as spawn from 'cross-spawn';
import { format } from 'util';
import chalk from 'chalk';
import * as cp from 'child_process';
import * as os from 'os';

let bail = false;
let i = 2;
outer: for (; i < process.argv.length; ++i) {
    const arg = process.argv[i];
    switch (arg) {
        default:
            break outer;
        case '--bail':
            bail = true;
    }
}

const [pattern, ...cmds] = process.argv.slice(i);

glob(trimSingleQuotes(pattern), (err, matches) => {
    if (err)
        throw err;
    let queue: string[] = [];
    let failed: Array<{cmd: string, code: number}> = [];
    for (const match of matches)
        for (const cmd of cmds)
            queue.push(format(trimSingleQuotes(cmd), match));
    const running = new Set<cp.ChildProcess>();
    const maxParallel = os.cpus().length;
    for (let j = 0; j < maxParallel; ++j)
        next();
    function next() {
        const cmd = queue.shift();
        if (cmd === undefined)
            return;
        console.log(chalk.grey(cmd));
        const p = spawn(cmd, undefined, {shell: true, stdio: 'inherit'})
            .on('exit', (code) => {
                running.delete(p);
                if (code) {
                    process.exitCode = code;
                    failed.push({cmd, code});
                    if (bail) {
                        for (const active of running)
                            active.kill();
                        running.clear();
                        queue = [];
                    }
                }
                next();
                if (running.size === 0 && failed.length !== 0) {
                    console.log(chalk.red('FAILED'));
                    for (const fail of failed)
                        console.log(fail.code, fail.cmd);
                    failed = [];
                }
            });
        running.add(p);
    }
});

function trimSingleQuotes(str: string) {
    return str.startsWith("'") && str.endsWith("'") ? str.slice(1, -1) : str;
}
