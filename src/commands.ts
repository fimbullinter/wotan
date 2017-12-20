import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import { findConfiguration, reduceConfigurationForFile } from './configuration';
import { LintOptions } from './linter';
import { loadFormatter } from './formatter-loader';
import { ConfigurationError } from './error';
import { RawConfiguration, Format } from './types';
import { format, assertNever } from './utils';
import chalk from 'chalk';
import * as mkdirp from 'mkdirp';
import { RuleTestHost, createBaseline, printDiff, test } from './test';
import { lintCollection } from './runner';

export const enum CommandName {
    Lint = 'lint',
    Verify = 'verify',
    Show = 'show',
    Test = 'test',
    Init = 'init',
}

export interface LintCommand extends LintOptions {
    command: CommandName.Lint;
    format: string | undefined;
}

export interface TestCommand {
    command: CommandName.Test;
    files: string[];
    updateBaselines: boolean;
    bail: boolean;
}

export interface VerifyCommand {
    command: CommandName.Verify;
    files: string[];
}

export interface ShowCommand {
    command: CommandName.Show;
    file: string;
    format: Format | undefined;
}

export interface InitCommand {
    command: CommandName.Init;
    directories: string[];
    format: Format | undefined;
    root: boolean | undefined;
}

export type Command = LintCommand | ShowCommand | VerifyCommand | InitCommand | TestCommand;

export function runCommand(command: Command): boolean {
    switch (command.command) {
        case CommandName.Lint:
            return runLint(command);
        case CommandName.Init:
            return runInit(command);
        case CommandName.Verify:
            return runVerify(command);
        case CommandName.Show:
            return runShow(command);
        case CommandName.Test:
            return runTest(command);
        default:
            return assertNever(command);
    }
}

function runLint(options: LintCommand): boolean {
    const result = lintCollection(options, process.cwd());
    let success = true;
    for (const [file, summary] of result) {
        if (summary.failures.length !== 0)
            success = false;
        if (options.fix && summary.fixes)
            fs.writeFileSync(file, summary.text, 'utf8');
    }

    const formatter = loadFormatter(options.format === undefined ? 'stylish' : options.format);
    console.log(formatter.format(result));
    return success;
}

function runInit(options: InitCommand): boolean {
    const filename = `.wotanrc.${options.format === undefined ? 'yaml' : options.format}`;
    const dirs = options.directories.length === 0 ? [process.cwd()] : options.directories;
    let success = true;
    for (const dir of dirs) {
        const fullPath = path.join(dir, filename);
        if (fs.existsSync(fullPath)) {
            console.error(`'${fullPath}' already exists.`);
            success = false;
        } else {
            fs.writeFileSync(fullPath, format<RawConfiguration>({extends: 'wotan:recommended', root: options.root}, options.format));
        }
    }
    return success;
}

function runVerify(_options: VerifyCommand): boolean {
    return true;
}

function runShow(options: ShowCommand): boolean {
    const cwd = process.cwd();
    const config = findConfiguration(options.file, cwd);
    if (config === undefined) {
        console.error(`Could not find configuration for '${options.file}'.`);
        return false;
    }
    console.log(format(reduceConfigurationForFile(config, options.file, cwd), options.format));
    return true;
}

export function runTest(options: TestCommand): boolean {
    let baselineDir: string;
    let root: string;
    let success = true;
    const host: RuleTestHost = {
        getBaseDirectory() { return root; },
        checkResult(file, kind, summary) {
            const relative = path.relative(root, file);
            if (relative.startsWith('..' + path.sep))
                throw new ConfigurationError(`Testing file '${file}' outside of '${root}'.`);
            const actual = createBaseline(summary);
            const baselineFile = `${path.resolve(baselineDir, relative)}.${kind}`;
            if (!fs.existsSync(baselineFile)) {
                if (!options.updateBaselines) {
                    console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.red('MISSING')}`);
                    success = false;
                    return !options.bail;
                }
                mkdirp.sync(path.dirname(baselineFile));
                fs.writeFileSync(baselineFile, actual, 'utf8');
                console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.green('CREATED')}`);
                return true;
            }
            const expected = fs.readFileSync(baselineFile, 'utf8');
            if (expected === actual) {
                console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.green('PASSED')}`);
                return true;
            }
            if (options.updateBaselines) {
                fs.writeFileSync(baselineFile, actual, 'utf8');
                console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.green('UPDATED')}`);
                return true;
            }
            console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.red('FAILED')}`);
            printDiff(actual, expected);
            success = false;
            return !options.bail;
        },
    };
    const globOptions = {
        absolute: true,
        cache: {},
        nodir: true,
        realpathCache: {},
        statCache: {},
        symlinks: {},
    };
    for (const pattern of options.files) {
        for (const testcase of glob.sync(pattern, globOptions)) {
            interface TestOptions extends LintOptions {
                baselines: string;
            }
            const {baselines, ...testConfig} = <Partial<TestOptions>>require(testcase);
            root = path.dirname(testcase);
            baselineDir = baselines === undefined ? root : path.resolve(root, baselines);
            console.log(testcase);
            if (!test(testConfig, host))
                return false;
        }
    }
    return success;
}
