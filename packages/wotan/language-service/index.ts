import * as ts from 'typescript';
import {
    FileSystem,
    MessageHandler,
    Finding,
    FileFilterFactory,
    DirectoryService,
    Resolver,
    GlobalOptions,
    StaticProgramState,
    StatePersistence,
    ContentId,
} from '@fimbul/ymir';
import { Container, BindingScopeEnum, ContainerModule } from 'inversify';
import { createCoreModule } from '../src/di/core.module';
import { createDefaultModule } from '../src/di/default.module';
import { ConfigurationManager } from '../src/services/configuration-manager';
import { Linter, LinterOptions } from '../src/linter';
import { addUnique, mapDefined } from '../src/utils';
import { CachedFileSystem } from '../src/services/cached-file-system';
import * as resolve from 'resolve';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { parseGlobalOptions, ParsedGlobalOptions } from '../src/argparse';
import { normalizeGlob } from 'normalize-glob';
import { Minimatch } from 'minimatch';
import { ProgramStateFactory } from '../src/services/program-state';
import { createConfigHash } from '../src/config-hash';

export type PartialLanguageServiceInterceptor = {
    // https://github.com/ajafff/tslint-consistent-codestyle/issues/85
    // tslint:disable-next-line: no-unused
    [K in keyof ts.LanguageService]?: ts.LanguageService[K] extends (...args: infer Parameters) => infer Return
        ? (prev: Return, ...args: Parameters) => Return
        : ts.LanguageService[K]
};

export const version = '1';

export class LanguageServiceInterceptor implements PartialLanguageServiceInterceptor {
    private lastProjectVersion = '';
    private findingsForFile = new WeakMap<ts.SourceFile, readonly Finding[]>();
    private oldState: StaticProgramState | undefined = undefined;
    public getExternalFiles?: () => string[]; // can be implemented later

    constructor(
        protected config: Record<string, unknown>,
        // tslint:disable:no-submodule-imports
        protected project: import('typescript/lib/tsserverlibrary').server.Project,
        protected serverHost: import('typescript/lib/tsserverlibrary').server.ServerHost,
        // tslint:enable:no-submodule-imports
        protected languageService: ts.LanguageService,
        protected require: (id: string) => {},
        protected log: (message: string) => void,
    ) {}

    public updateConfig(config: Record<string, unknown>) {
        this.config = config;
    }

    public getSemanticDiagnostics(diagnostics: ts.Diagnostic[], fileName: string): ts.Diagnostic[] {
        this.log(`getSemanticDiagnostics for ${fileName}`);
        const result = this.getFindingsForFile(fileName);
        if (result?.findings.length)
            diagnostics = diagnostics.concat(mapDefined(result.findings, (finding) => finding.severity === 'suggestion'
                ? undefined
                : {
                    file: result.file,
                    category: this.config.displayErrorsAsWarnings || finding.severity === 'warning'
                        ? ts.DiagnosticCategory.Warning
                        : ts.DiagnosticCategory.Error,
                    code: <any>finding.ruleName,
                    source: 'wotan',
                    messageText: finding.message,
                    start: finding.start.position,
                    length: finding.end.position - finding.start.position,
                },
            ));
        return diagnostics;
    }

    public getSuggestionDiagnostics(diagnostics: ts.DiagnosticWithLocation[], fileName: string): ts.DiagnosticWithLocation[] {
        this.log(`getSuggestionDiagnostics for ${fileName}`);
        const result = this.getFindingsForFile(fileName);
        if (result?.findings.length)
            diagnostics = diagnostics.concat(mapDefined(result.findings, (finding) => finding.severity !== 'suggestion'
                ? undefined
                : {
                    file: result.file,
                    category: ts.DiagnosticCategory.Suggestion,
                    code: <any>finding.ruleName,
                    source: 'wotan',
                    messageText: finding.message,
                    start: finding.start.position,
                    length: finding.end.position - finding.start.position,
                },
            ));
        return diagnostics;
    }

    private getFindingsForFile(fileName: string) {
        const program = this.languageService.getProgram();
        if (program === undefined)
            return;
        const file = program.getSourceFile(fileName);
        if (file === undefined) {
            this.log(`File ${fileName} is not included in the Program`);
            return;
        }
        const projectVersion = this.project.getProjectVersion();
        if (this.lastProjectVersion === projectVersion) {
            const cached = this.findingsForFile.get(file);
            if (cached !== undefined) {
                this.log(`Reusing last result with ${cached.length} findings`);
                return {file, findings: cached};
            }
        } else {
            this.findingsForFile = new WeakMap();
            this.lastProjectVersion = projectVersion;
        }
        const findings = this.getFindingsForFileWorker(file, program);
        this.findingsForFile.set(file, findings);
        return {file, findings};
    }

    private getFindingsForFileWorker(file: ts.SourceFile, program: ts.Program) {
        let globalConfigDir = this.project.getCurrentDirectory();
        let globalOptions: any;
        while (true) {
            const scriptSnapshot = this.project.getScriptSnapshot(globalConfigDir + '/.fimbullinter.yaml');
            if (scriptSnapshot !== undefined) {
                this.log(`Using '${globalConfigDir}/.fimbullinter.yaml' for global options`);
                globalOptions = yaml.load(scriptSnapshot.getText(0, scriptSnapshot.getLength())) || {};
                break;
            }
            const parentDir = path.dirname(globalConfigDir);
            if (parentDir === globalConfigDir) {
                this.log("Cannot find '.fimbullinter.yaml'");
                globalOptions = {};
                break;
            }
            globalConfigDir = parentDir;
        }
        const globalConfig = parseGlobalOptions(globalOptions);
        if (!isIncluded(file.fileName, globalConfigDir, globalConfig)) {
            this.log('File is excluded by global options');
            return [];
        }
        const container = new Container({defaultScope: BindingScopeEnum.Singleton});
        for (const module of globalConfig.modules)
            container.load(this.loadPluginModule(module, globalConfigDir, globalOptions));

        container.bind(StatePersistence).toConstantValue({
            loadState: () => this.oldState,
            saveState: (_, state) => this.oldState = state,
        });
        container.bind(ContentId).toConstantValue({
            forFile: (fileName) => this.project.getScriptVersion(fileName),
        });
        container.bind(FileSystem).toConstantValue(new ProjectFileSystem(this.project));
        container.bind(DirectoryService).toConstantValue({
            getCurrentDirectory: () => this.project.getCurrentDirectory(),
        });
        container.bind(Resolver).toDynamicValue((context) => {
            const fs = context.container.get(CachedFileSystem);
            return {
                getDefaultExtensions() {
                    return ['.js'];
                },
                resolve(id, basedir, extensions = ['.js'], paths) {
                    return resolve.sync(id, {
                        basedir,
                        extensions,
                        paths,
                        isFile: (f) => fs.isFile(f),
                        readFileSync: (f) => fs.readFile(f),
                    });
                },
                require: this.require,
            };
        });
        const warnings: string[] = [];
        container.bind(MessageHandler).toConstantValue({
            log: this.log,
            warn: (message) => {
                if (addUnique(warnings, message))
                    this.log(message);
            },
            error(e) {
                this.log(e.message);
            },
        });
        container.load(createCoreModule(globalOptions), createDefaultModule());
        const fileFilter = container.get(FileFilterFactory).create({program, host: this.project});
        if (!fileFilter.filter(file)) {
            this.log('File is excluded by FileFilter');
            return [];
        }
        const configManager = container.get(ConfigurationManager);
        const config = globalConfig.config === undefined
            ? configManager.find(file.fileName)
            : configManager.loadLocalOrResolved(globalConfig.config, globalConfigDir);
        const effectiveConfig = config && configManager.reduce(config, file.fileName);
        if (effectiveConfig === undefined) {
            this.log('File is excluded by configuration');
            return [];
        }

        const linterOptions: LinterOptions = {
            reportUselessDirectives: globalConfig.reportUselessDirectives
                ? globalConfig.reportUselessDirectives === true
                    ? 'error'
                    : globalConfig.reportUselessDirectives
                : undefined,
        };
        const programState = container.get(ProgramStateFactory).create(program, this.project, this.project.projectName);
        const configHash = createConfigHash(effectiveConfig, linterOptions);
        const cached = programState.getUpToDateResult(file.fileName, configHash);
        if (cached !== undefined) {
            this.log(`Using ${cached.length} cached findings`);
            return cached;
        }

        this.log('Start linting');
        const linter = container.get(Linter);
        const result = linter.lintFile(file, effectiveConfig, program, linterOptions);
        programState.setFileResult(file.fileName, configHash, result);
        programState.save();
        this.log(`Found ${result.length} findings`);
        return result;
    }

    private loadPluginModule(moduleName: string, basedir: string, options: GlobalOptions) {
        moduleName = resolve.sync(moduleName, {
            basedir,
            extensions: ['.js'],
            isFile: (f) => this.project.fileExists(f),
            readFileSync: (f) => this.project.readFile(f)!,
        });
        const m = <{createModule?(options: GlobalOptions): ContainerModule} | null | undefined>this.require(moduleName);
        if (!m || typeof m.createModule !== 'function')
            throw new Error(`Module '${moduleName}' does not export a function 'createModule'`);
        return m.createModule(options);
    }

    public getSupportedCodeFixes(fixes: string[]) {
        return fixes;
    }

    public cleanupSemanticCache() {
        this.findingsForFile = new WeakMap();
        this.oldState = undefined;
    }

    public dispose() {
        return this.languageService.dispose();
    }
}

function isIncluded(fileName: string, basedir: string, options: ParsedGlobalOptions): boolean {
    outer: if (options.files.length !== 0) {
        for (const include of options.files)
            for (const normalized of normalizeGlob(include, basedir))
                if (new Minimatch(normalized).match(fileName))
                    break outer;
        return false;
    }

    for (const exclude of options.exclude)
        for (const normalized of normalizeGlob(exclude, basedir))
            if (new Minimatch(normalized, {dot: true}).match(fileName))
                return false;
    return true;
}

class ProjectFileSystem implements FileSystem {
    public realpath = this.host.realpath && ((f: string) => this.host.realpath!(f));
    constructor(
        private host: Required<
            Pick<
                ts.LanguageServiceHost,
                'useCaseSensitiveFileNames' | 'readFile' | 'readDirectory' | 'fileExists' | 'directoryExists'
            >
        > & Pick<ts.LanguageServiceHost, 'realpath'>,
    ) {}
    public createDirectory() {
        throw new Error('should not be called');
    }
    public deleteFile() {
        throw new Error('should not be called');
    }
    public writeFile() {
        throw new Error('should not be called');
    }
    public normalizePath(f: string) {
        f = f.replace(/\\/g, '/');
        return this.host.useCaseSensitiveFileNames() ? f : f.toLowerCase();
    }
    public readFile(f: string) {
        const result = this.host.readFile(f);
        if (result === undefined)
            throw new Error('ENOENT');
        return result;
    }
    public readDirectory(dir: string) {
        return this.host.readDirectory(dir, undefined, undefined, ['*']);
    }
    public stat(f: string) {
        const isFile = this.host.fileExists(f)
            ? true
            : this.host.directoryExists(f)
                ? false
                : undefined;
        return {
            isDirectory() {
                return isFile === false;
            },
            isFile() {
                return isFile === true;
            },
        };
    }
}
