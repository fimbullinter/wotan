import * as ts from 'typescript';
import { FileSystem, MessageHandler, Finding, FileFilterFactory, DirectoryService, Resolver, GlobalOptions } from '@fimbul/ymir';
import { Container, BindingScopeEnum, ContainerModule } from 'inversify';
import { createCoreModule } from '../src/di/core.module';
import { createDefaultModule } from '../src/di/default.module';
import { ConfigurationManager } from '../src/services/configuration-manager';
import { Linter } from '../src/linter';
import { addUnique } from '../src/utils';
import { CachedFileSystem } from '../src/services/cached-file-system';
import * as resolve from 'resolve';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { parseGlobalOptions, ParsedGlobalOptions } from '../src/argparse';
import { normalizeGlob } from 'normalize-glob';
import { Minimatch } from 'minimatch';

export type PartialLanguageServiceInterceptor = {
    // https://github.com/ajafff/tslint-consistent-codestyle/issues/85
    // tslint:disable-next-line: no-unused
    [K in keyof ts.LanguageService]?: ts.LanguageService[K] extends (...args: infer Parameters) => infer Return
        ? (prev: Return, ...args: Parameters) => Return
        : ts.LanguageService[K]
};

export const version = '1';

export class LanguageServiceInterceptor implements PartialLanguageServiceInterceptor {
    private findingsForFile = new WeakMap<ts.SourceFile, ReadonlyArray<Finding>>();
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
        const program = this.languageService.getProgram()!;
        const file = program.getSourceFile(fileName);
        if (file === undefined) {
            this.log(`file ${fileName} is not included in the Program`);
        } else {
            this.log(`started linting ${fileName}`);
            const findings = this.getFindings(file, program);
            this.findingsForFile.set(file, findings);
            diagnostics = diagnostics.concat(findings.map((finding) => ({
                file,
                category: finding.severity === 'error'
                    ? this.config.displayErrorsAsWarnings
                        ? ts.DiagnosticCategory.Warning
                        : ts.DiagnosticCategory.Error
                    : finding.severity === 'warning'
                        ? ts.DiagnosticCategory.Warning
                        : ts.DiagnosticCategory.Suggestion,
                code: <any>finding.ruleName,
                source: 'wotan',
                messageText: finding.message,
                start: finding.start.position,
                length: finding.end.position - finding.start.position,
            })));
            this.log(`finished linting ${fileName} with ${findings.length} findings`);
        }
        return diagnostics;
    }

    private getFindings(file: ts.SourceFile, program: ts.Program) {
        let globalConfigDir = this.project.getCurrentDirectory();
        let globalOptions;
        while (true) {
            const scriptSnapshot = this.project.getScriptSnapshot(globalConfigDir + '/.fimbullinter.yaml');
            if (scriptSnapshot !== undefined) {
                this.log(`Using '${globalConfigDir}/.fimbullinter.yaml' for global options.`);
                globalOptions = yaml.safeLoad(scriptSnapshot.getText(0, scriptSnapshot.getLength())) || {};
                break;
            }
            const parentDir = path.dirname(globalConfigDir);
            if (parentDir === globalConfigDir) {
                this.log("Cannot find '.fimbullinter.yaml'.");
                globalOptions = {};
                break;
            }
            globalConfigDir = parentDir;
        }
        const globalConfig = parseGlobalOptions(globalOptions);
        if (!isIncluded(file.fileName, globalConfigDir, globalConfig))
            return [];
        const container = new Container({defaultScope: BindingScopeEnum.Singleton});
        for (const module of globalConfig.modules)
            container.load(this.loadPluginModule(module, globalConfigDir, globalOptions));

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
        if (!fileFilter.filter(file))
            return [];
        const configManager = container.get(ConfigurationManager);
        const config = globalConfig.config === undefined
            ? configManager.find(file.fileName)
            : configManager.loadLocalOrResolved(globalConfig.config, globalConfigDir);
        const effectiveConfig = config && configManager.reduce(config, file.fileName);
        if (effectiveConfig === undefined)
            return [];
        const linter = container.get(Linter);
        return linter.lintFile(file, effectiveConfig, () => program, {
            reportUselessDirectives: globalConfig.reportUselessDirectives
                ? globalConfig.reportUselessDirectives === true
                    ? 'error'
                    : globalConfig.reportUselessDirectives
                : undefined,
        });
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
            throw new Error(`Module '${moduleName}' does not export a function 'createModule'.`);
        return m.createModule(options);
    }

    public getSupportedCodeFixes(fixes: string[]) {
        return fixes;
    }

    public dispose() {
        // TODO clean up after ourselves
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
        throw new Error('should not be called.');
    }
    public deleteFile() {
        throw new Error('should not be called.');
    }
    public writeFile() {
        throw new Error('should not be called.');
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
