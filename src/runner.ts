import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { findConfiguration, reduceConfigurationForFile, parseConfigFile, resolveConfigFile, readConfigFile } from './configuration';
import { lintFile, lintAndFix } from './linter';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';
import { Minimatch, filter as createMinimatchFilter } from 'minimatch';
import { loadFormatter } from './formatter-loader';
import { ConfigurationError } from './error';
import { Configuration, RawConfiguration, FileSummary, LintResult, Failure } from './types';
import * as resolveGlob from 'to-absolute-glob';
import { unixifyPath } from './utils';
import chalk from 'chalk';
import * as mkdirp from 'mkdirp';

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

export interface LintCommand extends LintOptions {
    command: CommandName.Lint;
    format: string | undefined;
}

export interface LintOptions {
    config: string | undefined;
    files: string[];
    exclude: string[];
    project: string | undefined;
    fix: boolean | number;
}

export interface TestCommand {
    command: CommandName.Test;
    files: string[];
    updateBaselines: boolean;
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
    const result = doLint(options, process.cwd());
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

export function doLint(options: LintOptions, cwd: string): LintResult {
    let {files, program} = getFilesAndProgram(options, cwd);
    const result: LintResult = new Map();
    let dir: string | undefined;
    let config = options.config !== undefined ? resolveConfig(options.config, cwd) : undefined;
    const fixedFiles = new Map<string, string>();
    for (const file of files) {
        if (options.config === undefined) {
            const dirname = path.dirname(file);
            if (dir !== dirname) {
                config = findConfiguration(file, cwd);
                dir = dirname;
            }
        }
        const effectiveConfig = config && reduceConfigurationForFile(config, file, cwd);
        if (effectiveConfig === undefined)
            continue;
        let sourceFile = program === undefined
            ? ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true)
            : program.getSourceFile(file)!;
        let summary: FileSummary;
        if (options.fix) {
            let fileContent = sourceFile.text;
            const fixed = lintAndFix(
                sourceFile,
                effectiveConfig,
                (content, range) => {
                    fileContent = content;
                    fixedFiles.set(file, content);
                    if (program === undefined) {
                        sourceFile = ts.updateSourceFile(sourceFile, content, range);
                        return {file: sourceFile};
                    }
                    program = updateProgram(program, fixedFiles, sourceFile, content, range);
                    sourceFile = program.getSourceFile(file);
                    return {program, file: sourceFile};
                },
                options.fix === true ? undefined : options.fix,
                program,
            );
            summary = {
                failures: fixed.failures,
                fixes: fixed.fixes,
                text: fileContent,
            };
        } else {
            summary = {
                failures: lintFile(sourceFile, effectiveConfig, program),
                fixes: 0,
                text: sourceFile.text,
            };
        }
        result.set(file, summary);
    }
    return result;
}

function resolveConfig(pathOrName: string, cwd: string): Configuration {
    const absolute = path.resolve(cwd, pathOrName);
    const resolved = fs.existsSync(absolute) ? absolute : resolveConfigFile(pathOrName, cwd);
    return parseConfigFile(readConfigFile(resolved), resolved, false);
}

function updateProgram(
    oldProgram: ts.Program,
    fixed: Map<string, string>,
    currentFile: ts.SourceFile,
    newContent: string,
    changeRange: ts.TextChangeRange,
): ts.Program;
function updateProgram(
    oldProgram: ts.Program | undefined,
    fixed: Map<string, string>,
    currentFile: ts.SourceFile,
    newContent: string,
    changeRange: ts.TextChangeRange,
): ts.Program {
    const cwd = oldProgram!.getCurrentDirectory();
    const hostBackend = ts.createCompilerHost(oldProgram!.getCompilerOptions(), true);
    const host: ts.CompilerHost = {
        getSourceFile(fileName, languageVersion, _onError, shouldCreateNewSourceFile) {
            if (!shouldCreateNewSourceFile) {
                if (fileName === currentFile.fileName)
                    return ts.updateSourceFile(currentFile, newContent, changeRange);
                const sourceFile = oldProgram && oldProgram.getSourceFile(fileName);
                if (sourceFile !== undefined)
                    return sourceFile;
            }
            let content = fixed.get(fileName);
            if (content === undefined) {
                const file = oldProgram && oldProgram.getSourceFile(fileName);
                if (file !== undefined)
                    content = file.text;
            }
            return content !== undefined
                ? ts.createSourceFile(fileName, content, languageVersion, true)
                : hostBackend.getSourceFile(fileName, languageVersion);
        },
        getDefaultLibFileName: hostBackend.getDefaultLibFileName,
        getDefaultLibLocation: hostBackend.getDefaultLibLocation,
        writeFile() {},
        getCurrentDirectory: () => cwd,
        getDirectories: hostBackend.getDirectories,
        getCanonicalFileName: hostBackend.getCanonicalFileName,
        useCaseSensitiveFileNames: hostBackend.useCaseSensitiveFileNames,
        getNewLine: hostBackend.getNewLine,
        fileExists: hostBackend.fileExists,
        readFile: hostBackend.readFile,
        realpath: hostBackend.realpath,
        resolveModuleNames: hostBackend.resolveModuleNames,
        resolveTypeReferenceDirectives: hostBackend.resolveTypeReferenceDirectives,
    };

    const program = ts.createProgram(oldProgram!.getRootFileNames(), oldProgram!.getCompilerOptions(), host, oldProgram);
    oldProgram = undefined; // remove reference to avoid capturing in closure
    return program;
}

function getFilesAndProgram(options: LintOptions, cwd: string): {files: string[], program?: ts.Program} {
    let tsconfig: string | undefined;
    if (options.project !== undefined) {
        tsconfig = checkConfigDirectory(path.resolve(cwd, options.project));
    } else if (options.files.length === 0) {
        tsconfig = findupTsconfig(cwd);
    }
    let files: string[];
    if (tsconfig === undefined) {
        files = [];
        const globOptions = {
            cwd,
            absolute: true,
            cache: {},
            ignore: options.exclude,
            nodir: true,
            realpathCache: {},
            statCache: {},
            symlinks: {},
        };
        for (const pattern of options.files)
            files.push(...glob.sync(pattern, globOptions));
        files = Array.from(new Set(files.map(unixifyPath))); // deduplicate files
        checkFilesExist(options.files, options.exclude, files, 'does not exist', cwd);
        return { files };
    }
    const program = createProgram(tsconfig, cwd);
    if (options.files.length === 0) {
        const libDirectory = path.dirname(ts.getDefaultLibFilePath(program.getCompilerOptions()));
        files = program.getSourceFiles()
            .filter(
                (f) => path.relative(libDirectory, f.fileName) !== path.basename(f.fileName) && !program.isSourceFileFromExternalLibrary(f),
            )
            .map((f) => f.fileName);
        if (options.exclude.length !== 0) {
            const exclude = options.exclude.map((p) => new Minimatch(resolveGlob(p, {cwd}), {dot: true}));
            files = files.filter((f) => exclude.some((e) => e.match(f)));
        }
    } else {
        files = program.getSourceFiles().map((f) => f.fileName);
        const patterns = options.files.map((p) => new Minimatch(resolveGlob(p, {cwd})));
        const exclude = options.exclude.map((p) => new Minimatch(resolveGlob(p, {cwd})));
        files = files.filter((f) => patterns.some((p) => p.match(f)) && !exclude.some((e) => e.match(f)));
        checkFilesExist(options.files, options.exclude, files, 'is not included in the project', cwd);
    }
    return {files, program};
}

function findupTsconfig(directory: string): string {
    while (true) {
        const fullPath = path.join(directory, 'tsconfig.json');
        if (fs.existsSync(fullPath))
            return fullPath;
        const prev = directory;
        directory = path.dirname(directory);
        if (directory === prev)
            throw new ConfigurationError(`Cannot find tsconfig.json for current directory.`);
    }
}

function createProgram(configFile: string, cwd: string): ts.Program {
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    if (config.error !== undefined)
        throw new ConfigurationError(ts.formatDiagnostics([config.error], {
            getCanonicalFileName: (f) => f,
            getCurrentDirectory: () => cwd,
            getNewLine: () => '\n',
        }));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configFile), {noEmit: true});
    if (parsed.errors !== undefined) {
        // ignore 'TS18003: No inputs were found in config file ...'
        const errors = parsed.errors.filter((d) => d.code !== 18003);
        if (errors.length !== 0)
            throw new ConfigurationError(ts.formatDiagnostics(errors, {
                getCanonicalFileName: (f) => f,
                getCurrentDirectory: () => cwd,
                getNewLine: () => '\n',
            }));
    }
    return ts.createProgram(parsed.fileNames, parsed.options, ts.createCompilerHost(parsed.options, true));
}

function checkConfigDirectory(fileOrDirName: string): string {
    let stat: fs.Stats;
    try {
        stat = fs.statSync(fileOrDirName);
    } catch {
        throw new ConfigurationError(`The specified path does not exist: '${fileOrDirName}'`);
    }
    if (stat.isDirectory()) {
        fileOrDirName = path.join(fileOrDirName, 'tsconfig.json');
        if (!fs.existsSync(fileOrDirName))
            throw new ConfigurationError(`Cannot find a tsconfig.json file at the specified directory: '${fileOrDirName}'`);
    }
    return fileOrDirName;
}

/** Ensure that all non-pattern arguments, that are not excluded, matched  */
function checkFilesExist(patterns: string[], ignore: string[], matches: string[], errorSuffix: string, cwd: string) {
    patterns = patterns.filter((p) => !glob.hasMagic(p)).map((p) => path.resolve(cwd, p));
    if (patterns.length === 0)
        return;
    const exclude = ignore.map((p) => new Minimatch(resolveGlob(p, {cwd}), {dot: true}));
    for (const filename of patterns.filter((p) => !exclude.some((e) => e.match(p))))
        if (!matches.some(createMinimatchFilter(filename)))
            throw new ConfigurationError(`'${filename}' ${errorSuffix}.`);
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

function runTest(options: TestCommand): boolean {
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
            const testConfig = <Partial<TestOptions>>require(testcase);
            const root = path.dirname(testcase);
            test(
                {
                    baselines: root,
                    config: undefined,
                    exclude: [],
                    files: [],
                    fix: true,
                    project: undefined,
                    ...testConfig,
                    updateBaselines: options.updateBaselines,
                },
                root,
            );
            console.log(`${testcase} ${chalk.green('PASSED')}`);
        }
    }
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
    throw new ConfigurationError(`unexpected value '${v}'`);
}

export interface TestOptions extends LintOptions {
    baselines: string;
    updateBaselines: boolean;
}

export function test(options: TestOptions, cwd: string) {
    const baselineDir = path.resolve(cwd, options.baselines);
    const lintOptions: TestOptions = {...options, fix: false};
    const lintResult = doLint(lintOptions, cwd);
    checkResult(lintResult, cwd, baselineDir, '.lint', options.updateBaselines);
    if (options.fix) {
        const fixResult = containsFixes(lintResult) ? doLint(options, cwd) : lintResult;
        checkResult(fixResult, cwd, baselineDir, '.fix', options.updateBaselines);
    }
}

function containsFixes(result: LintResult): boolean {
    for (const {failures} of result.values())
        for (const failure of failures)
            if (failure.fix !== undefined)
                return true;
    return false;
}

function checkResult(result: LintResult, cwd: string, baselineDir: string, suffix: '.lint' | '.fix', update: boolean) {
    for (const [fileName, summary] of result) {
        const relative = path.relative(cwd, fileName);
        if (relative.startsWith(`..${path.sep}`))
            throw new Error(`Linting file '${fileName}' outside of '${cwd}'.`);
        const baselineFile = path.join(baselineDir, relative) + suffix;
        if (!fs.existsSync(baselineFile)) {
            if (!update)
                throw new Error(`Baseline '${baselineFile}' is missing.`);
            mkdirp.sync(path.dirname(baselineFile));
            fs.writeFileSync(baselineFile, createBaseline(summary), 'utf8');
        } else {
            const expected = fs.readFileSync(baselineFile, 'utf8');
            const actual = createBaseline(summary);
            if (expected !== actual) {
                if (!update)
                    throw new Error(`Baseline mismatch in '${baselineFile}'.`);
                fs.writeFileSync(baselineFile, actual, 'utf8');
            }
        }
    }
}

function createBaseline(summary: FileSummary): string {
    if (summary.failures.length === 0)
        return summary.text;

    const failures = summary.failures.slice().sort(Failure.compare);
    const lines: string[] = [];
    let lineStart = 0;
    let failurePosition = 0;
    let pendingFailures: Failure[] = [];
    for (const line of summary.text.split(/\n/g)) {
        lines.push(line);
        const nextLineStart = lineStart + line.length + 1;
        const lineLength = line.length - (line.endsWith('\r') ? 1 : 0);
        const lineEnd = lineStart + lineLength;
        const pending = [];
        for (const failure of pendingFailures) {
            const failureLength = Math.min(lineEnd, failure.end.position) - failure.start.position - lineStart;
            let errorLine = failureLength === 0 ? '~nil' : '~'.repeat(failureLength);
            if (failure.end.position <= nextLineStart) {
                errorLine = addPadding(errorLine, lineLength);
                errorLine += `[${failure.severity} ${failure.ruleName}: ${failure.message.replace(/[\r\n]/g, '\\$&')}]`;
            } else {
                pending.push(failure);
            }
            lines.push(errorLine);
        }
        pendingFailures = pending;

        for (; failurePosition < failures.length && failures[failurePosition].start.position < nextLineStart; ++failurePosition) {
            const failure = failures[failurePosition];
            let errorLine = ' '.repeat(failure.start.position - lineStart);
            const failureLength = Math.min(lineEnd, failure.end.position) - failure.start.position;
            errorLine += failureLength === 0 ? '~nil' : '~'.repeat(failureLength);
            if (failure.end.position <= nextLineStart) {
                errorLine = addPadding(errorLine, lineLength);
                errorLine += `[${failure.severity} ${failure.ruleName}: ${failure.message.replace(/[\r\n]/g, '\\$&')}]`;
            } else {
                pendingFailures.push(failure);
            }
            lines.push(errorLine);
        }

        lineStart = nextLineStart;
    }

    return lines.join('\n');
}

function addPadding(line: string, minLength: number): string {
    return line + ' '.repeat(Math.max(1, minLength - line.length + 1));
}
