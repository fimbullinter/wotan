import 'reflect-metadata';
import * as path from 'path';
import { LintOptions, Runner } from './runner';
import { ConfigurationError } from './error';
import { Format, MessageHandler, Failure, DirectoryService, GlobalOptions } from './types';
import { format, assertNever, unixifyPath, OFFSET_TO_NODE_MODULES } from './utils';
import chalk from 'chalk';
import { RuleTestHost, createBaseline, createBaselineDiff, RuleTester, BaselineKind } from './test';
import { FormatterLoader } from './services/formatter-loader';
import { Container, injectable, BindingScopeEnum, ContainerModule } from 'inversify';
import { CORE_DI_MODULE } from './di/core.module';
import { DEFAULT_DI_MODULE } from './di/default.module';
import { ConfigurationManager } from './services/configuration-manager';
import { CachedFileSystem } from './services/cached-file-system';
import * as glob from 'glob';
import { SemVer, satisfies } from 'semver';
import * as ts from 'typescript';
import * as resolve from 'resolve';
import debug = require('debug');

const log = debug('wotan:commands');

export const enum CommandName {
    Lint = 'lint',
    Validate = 'validate',
    Show = 'show',
    Test = 'test',
}

export interface BaseCommand<C extends CommandName> {
    command: C;
    modules: string[];
}

export interface LintCommand extends LintOptions, BaseCommand<CommandName.Lint> {
    formatter: string | undefined;
}

export interface TestCommand extends BaseCommand<CommandName.Test> {
    files: string[];
    updateBaselines: boolean;
    bail: boolean;
    exact: boolean;
}

export interface ValidateCommand extends BaseCommand<CommandName.Validate> {
    files: string[];
}

export interface ShowCommand extends BaseCommand<CommandName.Show> {
    file: string;
    format: Format | undefined;
    config: string | undefined;
}

export type Command = LintCommand | ShowCommand | ValidateCommand | TestCommand;

export async function runCommand(command: Command, diContainer?: Container, globalSettings: GlobalOptions = {}): Promise<boolean> {
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    if (diContainer !== undefined)
        container.parent = diContainer;
    for (const moduleName of command.modules)
        container.load(loadModule(moduleName, globalSettings));

    switch (command.command) {
        case CommandName.Lint:
            container.bind(AbstractCommandRunner).to(LintCommandRunner);
            break;
        case CommandName.Validate:
            container.bind(AbstractCommandRunner).to(ValidateCommandRunner);
            break;
        case CommandName.Show:
            container.bind(AbstractCommandRunner).to(ShowCommandRunner);
            break;
        case CommandName.Test:
            container.bind(AbstractCommandRunner).to(TestCommandRunner);
            container.bind(FakeDirectoryService).to(FakeDirectoryService);
            container.bind(DirectoryService).toService(FakeDirectoryService);
            break;
        default:
            return assertNever(command);
    }
    container.load(CORE_DI_MODULE, DEFAULT_DI_MODULE);
    const commandRunner = container.get(AbstractCommandRunner);
    return commandRunner.run(command);
}

function loadModule(moduleName: string, options: GlobalOptions) {
    log("Loading module '%s'.", moduleName);
    try {
        moduleName = resolve.sync(moduleName, {
            basedir: process.cwd(),
            extensions: Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
            paths: module.paths.slice(OFFSET_TO_NODE_MODULES),
        });
    } catch (e) {
        throw new ConfigurationError(e.message);
    }
    log("Found module at '$s'.", moduleName);
    const m = <{createModule?(options: GlobalOptions): ContainerModule}>require(moduleName);
    if (!m || typeof m.createModule !== 'function')
        throw new ConfigurationError(`Module '${moduleName}' does not export a function 'createModule'.`);
    return m.createModule(options);
}

@injectable()
abstract class AbstractCommandRunner {
    public abstract run(command: Command): boolean | Promise<boolean>;
}

@injectable()
class LintCommandRunner extends AbstractCommandRunner {
    constructor(
        private runner: Runner,
        private formatterLoader: FormatterLoader,
        private logger: MessageHandler,
        private fs: CachedFileSystem,
    ) {
        super();
    }
    public run(options: LintCommand) {
        const formatter = new (this.formatterLoader.loadFormatter(options.formatter === undefined ? 'stylish' : options.formatter))();
        const result = this.runner.lintCollection(options);
        let success = true;
        if (formatter.prefix !== undefined)
            this.logger.log(formatter.prefix);
        for (const [file, summary] of result) {
            if (summary.failures.some(isError))
                success = false;
            const formatted = formatter.format(file, summary);
            if (formatted !== undefined)
                this.logger.log(formatted);
            if (options.fix && summary.fixes)
                this.fs.writeFile(file, summary.content);
        }
        if (formatter.flush !== undefined) {
            const formatted = formatter.flush();
            if (formatted !== undefined)
                this.logger.log(formatted);
        }
        return success;
    }
}

function isError(failure: Failure) {
    return failure.severity === 'error';
}

@injectable()
class ValidateCommandRunner extends AbstractCommandRunner {
    constructor() {
        super();
    }
    public run(_options: ValidateCommand) {
        return true;
    }
}

@injectable()
class ShowCommandRunner extends AbstractCommandRunner {
    constructor(private configManager: ConfigurationManager, private logger: MessageHandler) {
        super();
    }
    public run(options: ShowCommand) {
        const config = options.config === undefined
            ? this.configManager.find(options.file)
            : this.configManager.loadLocalOrResolved(options.config);
        if (config === undefined)
            throw new ConfigurationError(`Could not find configuration for '${options.file}'.`);
        const reduced = this.configManager.reduce(config, options.file);
        this.logger.log(`${config.filename}\n${reduced === undefined ? 'File is excluded.' : format(reduced, options.format)}`);
        return true;
    }
}

@injectable()
class FakeDirectoryService implements DirectoryService {
    public cwd!: string;
    public getCurrentDirectory() {
        return this.cwd;
    }
}

@injectable()
class TestCommandRunner extends AbstractCommandRunner {
    constructor(
        private fs: CachedFileSystem,
        private container: Container,
        private logger: MessageHandler,
        private directoryService: FakeDirectoryService,
    ) {
        super();
    }

    public run(options: TestCommand) {
        const currentTypescriptVersion = getNormalizedTypescriptVersion();
        const basedir = process.cwd();
        let baselineDir: string;
        let root: string;
        let baselinesSeen: string[];
        let success = true;
        const host: RuleTestHost = {
            checkResult: (file, kind, summary) => {
                const relative = path.relative(root, file);
                if (relative.startsWith('..' + path.sep))
                    throw new ConfigurationError(`Testing file '${file}' outside of '${root}'.`);
                const actual = createBaseline(summary);
                const baselineFile = `${path.resolve(baselineDir, relative)}${kind === BaselineKind.Lint ? '.lint' : ''}`;
                const end = (pass: boolean, text: string, diff?: string) => {
                    this.logger.log(`  ${chalk.grey.dim(path.relative(basedir, baselineFile))} ${chalk[pass ? 'green' : 'red'](text)}`);
                    if (pass)
                        return true;
                    if (diff !== undefined)
                        this.logger.log(diff);
                    success = false;
                    return !options.bail;
                };
                if (kind === BaselineKind.Fix && summary.fixes === 0) {
                    if (!this.fs.isFile(baselineFile))
                        return true;
                    if (options.updateBaselines) {
                        this.fs.remove(baselineFile);
                        return end(true, 'REMOVED');
                    }
                    baselinesSeen.push(unixifyPath(baselineFile));
                    return end(false, 'EXISTS');
                }
                baselinesSeen.push(unixifyPath(baselineFile));
                let expected: string;
                try {
                    expected = this.fs.readFile(baselineFile);
                } catch {
                    if (!options.updateBaselines)
                        return end(false, 'MISSING');
                    this.fs.createDirectory(path.dirname(baselineFile));
                    this.fs.writeFile(baselineFile, actual);
                    return end(true, 'CREATED');
                }
                if (expected === actual)
                    return end(true, 'PASSED');
                if (options.updateBaselines) {
                    this.fs.writeFile(baselineFile, actual);
                    return end(true, 'UPDATED');
                }
                return end(false, 'FAILED', createBaselineDiff(actual, expected));
            },
        };
        this.container.bind(RuleTestHost).toConstantValue(host);
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
                interface TestOptions extends Partial<LintOptions> {
                    typescriptVersion?: string;
                }
                const {typescriptVersion, ...testConfig} = <TestOptions>require(testcase);
                if (typescriptVersion !== undefined && !satisfies(currentTypescriptVersion, typescriptVersion)) {
                    this.logger.log(
                        `${path.relative(basedir, testcase)} ${chalk.yellow(`SKIPPED, requires TypeScript ${typescriptVersion}`)}`,
                    );
                    continue;
                }
                root = path.dirname(testcase);
                baselineDir = buildBaselineDirectoryName(basedir, 'baselines', testcase);
                this.logger.log(path.relative(basedir, testcase));
                this.directoryService.cwd = root;
                baselinesSeen = [];
                if (!this.container.get(RuleTester).test(testConfig))
                    return false;
                if (options.exact) {
                    const remainingGlobOptions = {...globOptions, cwd: baselineDir, ignore: baselinesSeen};
                    for (const unchecked of glob.sync('**', remainingGlobOptions)) {
                        if (options.updateBaselines) {
                            this.fs.remove(unchecked);
                            this.logger.log(`  ${chalk.grey.dim(path.relative(basedir, unchecked))} ${chalk.green('REMOVED')}`);
                        } else {
                            this.logger.log(`  ${chalk.grey.dim(path.relative(basedir, unchecked))} ${chalk.red('UNCHECKED')}`);
                            if (options.bail)
                                return false;
                            success = false;
                        }
                    }
                }
            }
        }
        return success;
    }
}

function buildBaselineDirectoryName(basedir: string, baselineDir: string, testcase: string): string {
    const parts = path.relative(basedir, path.dirname(testcase)).split(path.sep);
    if (/^(__)?tests?(__)?$/.test(parts[0])) {
        parts[0] = baselineDir;
    } else {
        parts.unshift(baselineDir);
    }
    return path.resolve(basedir, parts.join(path.sep), getTestName(path.basename(testcase)));
}

function getTestName(basename: string): string {
    let ext = path.extname(basename);
    basename = basename.slice(0, -ext.length);
    ext = path.extname(basename);
    if (ext === '')
        return 'default';
    return basename.slice(0, -ext.length);
}

/** Removes everything related to prereleases and just returns MAJOR.MINOR.PATCH, thus treating prereleases like the stable release. */
function getNormalizedTypescriptVersion() {
    const v = new SemVer(ts.version);
    return new SemVer(`${v.major}.${v.minor}.${v.patch}`);
}
