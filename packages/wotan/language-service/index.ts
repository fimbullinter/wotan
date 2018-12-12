import * as ts from 'typescript';
import { FileSystem, MessageHandler, Failure, FileFilterFactory } from '@fimbul/ymir';
import bind from 'bind-decorator';
import { Container, BindingScopeEnum } from 'inversify';
import { createCoreModule } from '../src/di/core.module';
import { createDefaultModule } from '../src/di/default.module';
import { ConfigurationManager } from '../src/services/configuration-manager';
import { Linter } from '../src/linter';
import { addUnique } from '../src/utils';

export class LanguageServicePlugin {
    private failuresForFile = new WeakMap<ts.SourceFile, ReadonlyArray<Failure>>();
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

    @bind
    private getSemanticDiagnostics(fileName: string): ts.Diagnostic[] {
        let diagnostics = this.languageService.getSemanticDiagnostics(fileName);
        const program = this.languageService.getProgram()!;
        const file = program.getSourceFile(fileName);
        if (file !== undefined) {
            this.log(`started linting ${fileName}`);
            try {
                const failures = this.getFailures(file, program);
                this.failuresForFile.set(file, failures);
                diagnostics = diagnostics.concat(failures.map((failure) => ({
                    file,
                    category: failure.severity === 'error' && !this.config.displayErrorsAsWarnings
                        ? ts.DiagnosticCategory.Error
                        : ts.DiagnosticCategory.Warning,
                    code: <any>failure.ruleName,
                    source: 'wotan',
                    messageText: failure.message,
                    start: failure.start.position,
                    length: failure.end.position - failure.start.position,
                })));
                this.log(`finished linting ${fileName}, found ${failures.length} failures`);
            } catch (e) {
                this.log(`linting ${fileName} failed: ${e && e.message}`);
            }
        }
        return diagnostics;
    }

    private getFailures(file: ts.SourceFile, program: ts.Program) {
        // TODO load .fimbullinter.yaml and
        //  use it to load plugin modules
        //  use include and exclude options
        //  use config option
        // TODO use CancellationToken to abort if necessary
        const container = new Container({defaultScope: BindingScopeEnum.Singleton});
        container.bind(FileSystem).toConstantValue(new ProjectFileSystem(this.project));
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
        container.load(createCoreModule({}), createDefaultModule()); // TODO pass global options
        const fileFilter = container.get(FileFilterFactory).create({program, host: this.project});
        if (!fileFilter.filter(file))
            return [];
        const configManager = container.get(ConfigurationManager);
        const config = configManager.find(file.fileName);
        const effectiveConfig = config && configManager.reduce(config, file.fileName);
        if (effectiveConfig === undefined)
            return [];
        const linter = container.get(Linter);
        return linter.lintFile(file, effectiveConfig, program);
    }

    public createInterceptor(): Partial<ts.LanguageService> {
        return {
            dispose: this.dispose,
            getSemanticDiagnostics: this.getSemanticDiagnostics,
        };
    }

    @bind
    private dispose() {
        // TODO clean up after ourselves
        return this.languageService.dispose();
    }
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
