import { injectable, ContainerModule } from 'inversify';
import { DirectoryService, MessageHandler, ConfigurationError, FileSummary, Failure } from '@fimbul/ymir';
import { AbstractCommandRunner, TestCommand } from './base';
import { CachedFileSystem } from '../services/cached-file-system';
import { createBaseline } from '../baseline';
import * as path from 'path';
import chalk from 'chalk';
import { unixifyPath } from '../utils';
import * as glob from 'glob';
import { satisfies, SemVer } from 'semver';
import { LintOptions, Runner } from '../runner';
import * as ts from 'typescript';
import * as diff from 'diff';
import { GLOBAL_OPTIONS_SPEC } from '../argparse';
import { OptionParser } from '../optparse';

const enum BaselineKind {
    Lint = 'lint',
    Fix = 'fix',
}

interface RuleTestHost {
    checkResult(file: string, kind: BaselineKind, result: FileSummary): boolean;
}

@injectable()
class FakeDirectoryService implements DirectoryService {
    public cwd!: string;

    constructor(private realDirectorySerivce: DirectoryService) {}

    public getCurrentDirectory() {
        return this.cwd;
    }

    public getRealCurrentDirectory() {
        return this.realDirectorySerivce.getCurrentDirectory();
    }
}

@injectable()
class TestCommandRunner extends AbstractCommandRunner {
    constructor(
        private runner: Runner,
        private fs: CachedFileSystem,
        private logger: MessageHandler,
        private directoryService: FakeDirectoryService,
    ) {
        super();
    }

    public run(options: TestCommand) {
        const currentTypescriptVersion = getNormalizedTypescriptVersion();
        const basedir = this.directoryService.getRealCurrentDirectory();
        let baselineDir: string;
        let root: string;
        let baselinesSeen: string[];
        let success = true;
        const host: RuleTestHost = {
            checkResult: (file, kind, summary) => {
                const relative = path.relative(root, file);
                if (relative.startsWith('..' + path.sep))
                    throw new ConfigurationError(`Testing file '${file}' outside of '${root}'.`);
                const actual = kind === BaselineKind.Fix ? summary.content : createBaseline(summary);
                const baselineFile = `${path.resolve(baselineDir, relative)}.${kind}`;
                const end = (pass: boolean, text: string, baselineDiff?: string) => {
                    this.logger.log(`  ${chalk.grey.dim(path.relative(basedir, baselineFile))} ${chalk[pass ? 'green' : 'red'](text)}`);
                    if (pass)
                        return true;
                    if (baselineDiff !== undefined)
                        this.logger.log(baselineDiff);
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
        const globOptions = {
            absolute: true,
            cache: {},
            nodir: true,
            realpathCache: {},
            statCache: {},
            symlinks: {},
            cwd: basedir,
        };
        for (const pattern of options.files) {
            for (const testcase of glob.sync(pattern, globOptions)) {
                const {typescriptVersion, ...testConfig} = OptionParser.parse(
                    require(testcase),
                    {
                        ...GLOBAL_OPTIONS_SPEC,
                        fix: OptionParser.Parser.parsePrimitive('boolean', 'number'), // no default
                        typescriptVersion: OptionParser.Parser.parsePrimitive('string'),
                    },
                    {validate: true, context: testcase},
                );
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
                if (!this.test(testConfig, host))
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

    private test(config: {[K in keyof LintOptions]: LintOptions[K] | (K extends 'fix' ? undefined : never)}, host: RuleTestHost): boolean {
        const lintOptions: LintOptions = {...config, fix: false};
        const lintResult = Array.from(this.runner.lintCollection(lintOptions));
        let containsFixes = false;
        for (const [fileName, summary] of lintResult) {
            if (!host.checkResult(fileName, BaselineKind.Lint, summary))
                return false;
            containsFixes = containsFixes || summary.failures.some(isFixable);
        }

        if (config.fix || config.fix === undefined) {
            lintOptions.fix = config.fix || true; // fix defaults to true if not specified
            const fixResult = containsFixes ? this.runner.lintCollection(lintOptions) : lintResult;
            for (const [fileName, summary] of fixResult)
                if (!host.checkResult(fileName, BaselineKind.Fix, summary))
                    return false;
        }
        return true;
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

function isFixable(failure: Failure): boolean {
    return failure.fix !== undefined;
}

function createBaselineDiff(actual: string, expected: string) {
    const result = [
        chalk.red('Expected'),
        chalk.green('Actual'),
    ];
    const lines = diff.createPatch('', expected, actual, '', '').split(/\n(?!\\)/g).slice(4);
    for (let line of lines) {
        switch (line[0]) {
            case '@':
                line = chalk.blueBright(line);
                break;
            case '+':
                line = chalk.green('+' + prettyLine(line.substr(1)));
                break;
            case '-':
                line = chalk.red('-' + prettyLine(line.substr(1)));
        }
        result.push(line);
    }
    return result.join('\n');
}

function prettyLine(line: string): string {
    return line
        .replace(/\t/g, '\u2409') // ␉
        .replace(/\r$/, '\u240d') // ␍
        .replace(/^\uFEFF/, '<BOM>');
}

export const module = new ContainerModule((bind) => {
    bind(FakeDirectoryService).toSelf().inSingletonScope();
    bind(DirectoryService).toDynamicValue((context) => {
        return context.container.get(FakeDirectoryService);
    }).inSingletonScope().when((request) => {
        return request.parentRequest == undefined || request.parentRequest.target.serviceIdentifier !== FakeDirectoryService;
    });
    bind(DirectoryService).toDynamicValue(({container}) => {
        if (container.parent && container.parent.isBound(DirectoryService))
            return container.parent.get(DirectoryService);
        return {
            getCurrentDirectory() {
                return process.cwd();
            },
        };
    }).inSingletonScope().whenInjectedInto(FakeDirectoryService);
    bind(AbstractCommandRunner).to(TestCommandRunner);
});
