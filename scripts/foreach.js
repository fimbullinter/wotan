const glob =require('glob');
const spawn = require('cross-spawn');
const chalk = require('chalk').default;
const os = require('os');

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
    /** @type {Array<string>} */
    let queue = [];
    /** @type {Array<{cmd: string, code: number}>} */
    let failed = [];
    for (const match of matches)
        for (const cmd of cmds)
            queue.push(formatCommand(trimSingleQuotes(cmd), match));
    const running = new Set();
    const maxParallel = os.cpus().length;
    for (let j = 0; j < maxParallel; ++j)
        next();
    function next() {
        const cmd = queue.shift();
        if (cmd === undefined)
            return;
        console.log(chalk.grey('$ ' + cmd));
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

/**
 * @param {string} str
 */
function trimSingleQuotes(str) {
    return str.startsWith("'") && str.endsWith("'") ? str.slice(1, -1) : str;
}

/**
 * @param {string} cmd
 * @param {string} file
 */
function formatCommand(cmd, file) {
    return cmd.replace('{{file}}', file);
}
