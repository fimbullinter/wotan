import * as packlist from 'npm-packlist';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as diff from 'diff';
import * as rimraf from 'rimraf';
import chalk from 'chalk';
import { getPackages } from './util';

const update = process.argv[2] === '-u';

for (const pkg of getPackages().publicPackages.keys()) {
    const packageDir = path.join('packages', pkg);
    const baselineDir = path.join('baselines', packageDir, 'api');
    if (update)
        rimraf.sync(baselineDir);
    checkPackage(packageDir, baselineDir, update ? writeFile : compareFile);

}

function checkPackage(packageDir: string, baselineDir: string, callback: (content: string, filename: string) => void) {
    const list = packlist.sync({path: packageDir});
    callback(list.join('\n'), path.join(baselineDir, 'packlist.txt'));

    for (const file of list)
        if (file.endsWith('.d.ts'))
            callback(fs.readFileSync(path.join(packageDir, file), 'utf8'), path.join(baselineDir, file));
}

function writeFile(content: string, fileName: string) {
    mkdirp.sync(path.dirname(fileName));
    fs.writeFileSync(fileName, content);
}

function compareFile(actual: string, fileName: string) {
    let expected = '';
    try {
        expected = fs.readFileSync(fileName, 'utf8');
    } catch {
    }
    if (expected === actual)
        return;
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
