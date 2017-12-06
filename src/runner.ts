import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { Configuration, findConfiguration, reduceConfigurationForFile, RawConfig } from './configuration';
import { lint, lintAndFix } from './linter';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';
import { Minimatch, filter as createMinimatchFilter } from 'minimatch';
import { loadFormatter } from './format';

export const enum CommandName {
    Lint = 'lint',
    Verify = 'verify',
    Show = 'show',
    Test = 'test',
    Init = 'init',
}

export const enum Format {
    Yaml = 'yaml',
    Json = 'json',
    Json5 = 'json5',
}

export interface LintCommand {
    command: CommandName.Lint;
    files: string[];
    exclude: string[];
    project: string | undefined;
    format: string | undefined;
    fix: boolean | number;
}

export interface TestCommand {
    command: CommandName.Test;
    files: string[];
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

export function run(command: Command): boolean {
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
    // TODO findup tsconfig.json
    const files = [];
    for (const pattern of options.files)
        files.push(...glob.sync(pattern, {
            ignore: options.exclude,
            absolute: true,
        }));
    checkFilesExist(options.files, options.exclude, files);
    const failures = [];
    let dir: string | undefined;
    let config: Configuration | undefined;
    let totalFixes = 0;
    for (const file of files) {
        const dirname = path.dirname(file);
        if (dir !== dirname) {
            config = findConfiguration(file);
            dir = dirname;
        }
        const effectiveConfig = config && reduceConfigurationForFile(config, file);
        if (effectiveConfig === undefined)
            continue;
        const content = fs.readFileSync(file, 'utf8');
        let sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true);
        if (options.fix) {
            let updatedContent: string | undefined;
            const fixed = lintAndFix(sourceFile, effectiveConfig, options.fix === true ? undefined : options.fix, (newContent, range) => {
                updatedContent = newContent;
                return sourceFile = ts.updateSourceFile(sourceFile, newContent, range);
            });
            failures.push(...fixed.failures);
            totalFixes += fixed.fixes;
            if (updatedContent !== undefined)
                fs.writeFileSync(file, updatedContent, 'utf8');
        } else {
            failures.push(...lint(sourceFile, effectiveConfig));
        }
    }
    const formatter = loadFormatter(options.format === undefined ? 'stylish' : options.format);
    console.log(formatter.format(failures, totalFixes));
    return failures.length === 0;
}

/** Ensure that all non-pattern arguments, that are not excluded, matched  */
function checkFilesExist(patterns: string[], ignore: string[], matches: string[]) {
    patterns = patterns.filter((p) => !glob.hasMagic(p));
    if (patterns.length === 0)
        return;
    const exclude = ignore.map((p) => new Minimatch(p, {dot: true}));
    for (const filename of patterns.filter((p) => !exclude.some((e) => e.match(p))))
        if (!matches.some(createMinimatchFilter(path.resolve(filename))))
            throw new Error(`'${filename}' does not exist.`);
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
            fs.writeFileSync(fullPath, format<RawConfig>({extends: 'wotan:recommended', root: options.root}, options.format));
        }
    }
    return success;
}

function runVerify(_options: VerifyCommand): boolean {
    return true;
}

function runShow(options: ShowCommand): boolean {
    const config = findConfiguration(options.file);
    if (config === undefined) {
        console.error(`Could not find configuration for '${options.file}'.`);
        return false;
    }
    console.log(format(reduceConfigurationForFile(config, options.file), options.format));
    return true;
}

function runTest(_options: TestCommand): boolean {
    return true;
}

function format<T = any>(value: T, fmt = Format.Yaml): string {
    value = convertToPrintable(value);
    switch (fmt) {
        case Format.Json:
            return JSON.stringify(value, undefined, 2);
        case Format.Json5:
            return json5.stringify(value, undefined, 2);
        case Format.Yaml:
            return yaml.safeDump(value, {
                indent: 2,
                schema: yaml.JSON_SCHEMA,
                sortKeys: true,
            });
        default:
            return assertNever(fmt);
    }
}

function convertToPrintable(value: any): any {
    if (value == undefined || typeof value !== 'object')
        return value;
    if (value instanceof Map) {
        const obj: {[key: string]: any} = {};
        for (const [k, v] of value)
            if (v !== undefined)
                obj[k] = v;
        value = obj;
    }
    if (Array.isArray(value)) {
        const result = [];
        for (const element of value) {
            const converted = convertToPrintable(element);
            if (converted !== undefined)
                result.push(converted);
        }
        return result.length === 0 ? undefined : result;
    }
    const keys = Object.keys(value);
    if (keys.length === 0)
        return;
    let added = false;
    const newValue: {[key: string]: any} = {};
    for (const key of keys) {
        const converted = convertToPrintable(value[key]);
        if (converted !== undefined) {
            newValue[key] = converted;
            added = true;
        }
    }
    return added ? newValue : undefined;
}

function assertNever(v: never): never {
    throw new Error(`unexpected value '${v}'`);
}
