"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const glob = require("glob");
const spawn = require("cross-spawn");
const util_1 = require("util");
const chalk_1 = require("chalk");
const os = require("os");
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
    let queue = [];
    let failed = [];
    for (const match of matches)
        for (const cmd of cmds)
            queue.push(util_1.format(trimSingleQuotes(cmd), match));
    const running = new Set();
    const maxParallel = os.cpus().length;
    for (let j = 0; j < maxParallel; ++j)
        next();
    function next() {
        const cmd = queue.shift();
        if (cmd === undefined)
            return;
        console.log(chalk_1.default.grey(cmd));
        const p = spawn(cmd, undefined, { shell: true, stdio: 'inherit' })
            .on('exit', (code) => {
            running.delete(p);
            if (code) {
                process.exitCode = code;
                failed.push({ cmd, code });
                if (bail) {
                    for (const active of running)
                        active.kill();
                    running.clear();
                    queue = [];
                }
            }
            next();
            if (running.size === 0 && failed.length !== 0) {
                console.log(chalk_1.default.red('FAILED'));
                for (const fail of failed)
                    console.log(fail.code, fail.cmd);
                failed = [];
            }
        });
        running.add(p);
    }
});
function trimSingleQuotes(str) {
    return str.startsWith("'") && str.endsWith("'") ? str.slice(1, -1) : str;
}
//# sourceMappingURL=foreach.js.map