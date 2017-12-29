import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';
import { findConfiguration, reduceConfigurationForFile } from './configuration';
import { LintOptions, lintCollection } from './runner';
import { loadFormatter } from './formatter-loader';
import { ConfigurationError } from './error';
import { RawConfiguration, Format } from './types';
import { format, assertNever, unixifyPath, writeFile, readFile, globAsync, unlinkFile } from './utils';
import chalk from 'chalk';
import * as mkdirp from 'mkdirp';
import { RuleTestHost, createBaseline, printDiff, test } from './test';

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
    exact: boolean;
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

export async function runCommand(command: Command): Promise<boolean> {
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

function runLint(options: LintCommand) {
    // fail early if formatter does not exist
    const formatter = loadFormatter(options.format === undefined ? 'stylish' : options.format);
    const result = lintCollection(options, process.cwd());
    let success = true;
    const fixes = [];
    for (const [file, summary] of result) {
        if (summary.failures.length !== 0)
            success = false;
        if (options.fix && summary.fixes)
            fixes.push(writeFile(file, summary.text));
    }
    console.log(formatter.format(result));
    return fixes.length === 0 ? success : Promise.all(fixes).then(() => success);
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

export async function runTest(options: TestCommand): Promise<boolean> {
    let baselineDir: string;
    let root: string;
    let success = true;
    const baselinesSeen: string[] = [];
    const baselinesAvailable = [];
    const host: RuleTestHost = {
        getBaseDirectory() { return root; },
        async checkResult(file, kind, summary) {
            const relative = path.relative(root, file);
            if (relative.startsWith('..' + path.sep))
                throw new ConfigurationError(`Testing file '${file}' outside of '${root}'.`);
            const actual = createBaseline(summary);
            const baselineFile = `${path.resolve(baselineDir, relative)}.${kind}`;
            baselinesSeen.push(baselineFile);
            let expected: string;
            try {
                expected = await readFile(baselineFile);
            } catch (e) {
                if (e.code !== 'ENOENT')
                    throw e;
                if (!options.updateBaselines) {
                    console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.red('MISSING')}`);
                    success = false;
                    return !options.bail;
                }
                return new Promise<boolean>((res, rej) => {
                    mkdirp(path.dirname(baselineFile), (err) => {
                        if (err)
                            return rej(err);
                        return res(writeFile(baselineFile, actual).then(() => {
                                console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.green('CREATED')}`);
                                return true;
                            }));
                    });
                });
            }
            if (expected === actual) {
                console.log(`  ${chalk.grey.dim(baselineFile)} ${chalk.green('PASSED')}`);
                return true;
            }
            if (options.updateBaselines) {
                await writeFile(baselineFile, actual);
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
        for (const testcase of await globAsync(pattern, globOptions)) {
            interface TestOptions extends LintOptions {
                baselines: string;
            }
            const {baselines, ...testConfig} = <Partial<TestOptions>>require(testcase);
            root = path.dirname(testcase);
            baselineDir = baselines === undefined ? root : path.resolve(root, baselines);
            if (options.exact)
                baselinesAvailable.push(globAsync(`${unixifyPath(baselineDir)}/**/*.{lint,fix}`, globOptions));
            console.log(testcase);
            if (!await test(testConfig, host))
                return false;
        }
    }
    if (options.exact) {
        const totalBaselines = new Set();
        for (const result of baselinesAvailable)
            for (const baseline of await result)
                totalBaselines.add(baseline);

        for (const seen of baselinesSeen)
            totalBaselines.delete(seen);

        if (totalBaselines.size !== 0) {
            let suffix: string;
            if (options.updateBaselines) {
                suffix = chalk.green('REMOVED');
                await Promise.all([...totalBaselines].map(unlinkFile));
            } else {
                suffix = chalk.red('NOT CHECKED');
                success = false;
            }
            for (const baseline of totalBaselines)
                console.log(`  ${chalk.grey.dim(baseline)} ${suffix}`);
        }
    }
    return success;
}
