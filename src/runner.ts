import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { Configuration, findConfiguration, reduceConfigurationForFile, RawConfig } from './configuration';
import { lint } from './linter';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';

export const enum CommandKind {
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
    command: CommandKind.Lint;
    files: string[];
    exclude: string[];
    project: string | undefined;
}

export interface TestCommand {
    command: CommandKind.Test;
    files: string[];
}

export interface VerifyCommand {
    command: CommandKind.Verify;
    files: string[];
}

export interface ShowCommand {
    command: CommandKind.Show;
    file: string;
    format: Format | undefined;
}

export interface InitCommand {
    command: CommandKind.Init;
    directories: string[];
    format: Format | undefined;
    root: boolean | undefined;
}

export type Command = LintCommand | ShowCommand | VerifyCommand | InitCommand | TestCommand;

export function run(command: Command): boolean {
    switch (command.command) {
        case CommandKind.Lint:
            return runLint(command);
        case CommandKind.Init:
            return runInit(command);
        case CommandKind.Verify:
            return runVerify(command);
        case CommandKind.Show:
            return runShow(command);
        case CommandKind.Test:
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
    let failures = false;
    let dir: string | undefined;
    let config: Configuration | undefined;
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
        const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true);
        const result = lint(sourceFile, effectiveConfig);
        if (result.length !== 0) {
            failures = true;
            console.log(result);
        }
    }
    return !failures;
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
