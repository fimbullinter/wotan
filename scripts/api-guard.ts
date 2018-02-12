import * as packlist from 'npm-packlist';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as diff from 'diff';
import chalk from 'chalk';

if (process.argv.length < 3) {
    console.log('Usage: node scripts/api-guard <package> [-u]');
    process.exit(1);
}

const p = 'packages/' + process.argv[2];
const update = process.argv[3] === '-u';
const list = packlist.sync({path: p});

const baselineDir = path.join(p, 'baselines/package');

compare(list.join('\n'), path.join(baselineDir, 'packlist.txt'));

// TODO compare generated declaration files, compile a dummy project to find missing symbols, detect unnecessary declaration files
// for (const file of list)
//     if (file.endsWith('.d.ts'))
//         compare(fs.readFileSync(path.join(p, file), 'utf8'), path.join(baselineDir, file));

function compare(actual: string, fileName: string) {
    let expected = '';
    try {
        expected = fs.readFileSync(fileName, 'utf8');
    } catch {
        if (update) {
            mkdirp.sync(path.dirname(fileName));
            fs.writeFileSync(fileName, actual);
            return;
        }
    }
    if (expected === actual)
        return;
    if (update) {
        fs.writeFileSync(fileName, actual);
        return;
    }
    const output = [
        chalk.underline(fileName),
        chalk.red('Expected'),
        chalk.green('Actual'),
    ];
    const lines = diff.createPatch('', expected, actual, '', '').split(/\n(?!\\)/g).slice(4);
    for (const line of lines) {
        switch (line[0]) {
            case '@':
                break;
            case '+':
                output.push(chalk.green(line));
                break;
            case '-':
                output.push(chalk.red(line));
                break;
            default:
                output.push(line);
        }
    }
    console.log(output.join('\n'));
    process.exitCode = 1;
}
