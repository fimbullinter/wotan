import * as packlist from 'npm-packlist';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as diff from 'diff';
import * as rimraf from 'rimraf';
import chalk from 'chalk';
import { getPackages } from './util';
import * as ts from 'typescript';

const update = process.argv[2] === '-u';

for (const pkg of getPackages().publicPackages.keys()) {
    const packageDir = path.join('packages', pkg);
    const baselineDir = path.join('baselines', packageDir, 'api');
    if (update)
        rimraf.sync(baselineDir);
    checkPackage(packageDir, baselineDir, update ? writeFile : compareFile);

}

function checkPackage(packageDir: string, baselineDir: string, callback: (content: string, filename: string) => void) {
    const list = packlist.sync({path: packageDir}).sort();
    callback(list.join('\n') + '\n', path.join(baselineDir, 'packlist.txt'));

    for (const file of list)
        if (file.endsWith('.d.ts'))
            callback(stripPrivateMembers(fs.readFileSync(path.join(packageDir, file), 'utf8')), path.join(baselineDir, file));
}

function stripPrivateMembers(source: string) {
    const re = /^ +private (?:readonly |get |set )?\w+(?:\(\w*\))?;\n/mg;
    let lastPos = 0;
    let result = '';
    let useAst = false;
    for (let match = re.exec(source); match !== null; match = re.exec(source)) {
        if (source.substr(match.index - 3, 3) === '*/\n') {
            // to correctly remove the JSDoc comment we need to parse the source
            useAst = true;
            continue;
        }
        result += source.substring(lastPos, match.index);
        lastPos = re.lastIndex;
    }
    result += source.substr(lastPos);
    if (useAst) {
        source = result;
        result = '';
        lastPos = 0;
        ts.createSourceFile('a.d.ts', source, ts.ScriptTarget.ESNext).statements.forEach(function visitStatement(statement: ts.Statement) {
            if (ts.isModuleDeclaration(statement) && statement.body !== undefined) {
                if (statement.body.kind === ts.SyntaxKind.ModuleDeclaration) {
                    visitStatement(statement.body);
                } else {
                    (<ts.ModuleBlock>statement.body).statements.forEach(visitStatement);
                }
            }
            if (ts.isClassDeclaration(statement)) {
                for (const member of statement.members) {
                    if (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Private) {
                        result += source.substring(lastPos, member.pos);
                        lastPos = member.end;
                    }
                }
            }
        });
        result += source.substr(lastPos);
    }
    return result;
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
