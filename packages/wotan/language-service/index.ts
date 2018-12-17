import * as ts from 'typescript';
import { FileSystem, MessageHandler, Failure, FileFilterFactory, DirectoryService, Resolver } from '@fimbul/ymir';
import { Container, BindingScopeEnum } from 'inversify';
import { createCoreModule } from '../src/di/core.module';
import { createDefaultModule } from '../src/di/default.module';
import { ConfigurationManager } from '../src/services/configuration-manager';
import { Linter } from '../src/linter';
import { addUnique } from '../src/utils';
import { CachedFileSystem } from '../src/services/cached-file-system';
import resolve = require('resolve');

export type PartialLanguageServiceInterceptor = {
    // https://github.com/ajafff/tslint-consistent-codestyle/issues/85
    // tslint:disable-next-line: no-unused
    [K in keyof ts.LanguageService]?: ts.LanguageService[K] extends (...args: infer Parameters) => infer Return
        ? (prev: Return, ...args: Parameters) => Return
        : ts.LanguageService[K]
};

export const version = '1';

export class LanguageServiceInterceptor implements PartialLanguageServiceInterceptor {
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

    public getSemanticDiagnostics(diagnostics: ts.Diagnostic[], fileName: string): ts.Diagnostic[] {
        const program = this.languageService.getProgram()!;
        const file = program.getSourceFile(fileName);
        if (file === undefined) {
            this.log(`file ${fileName} is not included in the Program`);
        } else {
            this.log(`started linting ${fileName}`);
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
        }
        return diagnostics;
    }

    private getFailures(file: ts.SourceFile, program: ts.Program) {
        // TODO load .fimbullinter.yaml and
        //  use it to load plugin modules
        //  use include and exclude options
        //  use config option
        // TODO use CancellationToken to abort if necessary?
        const container = new Container({defaultScope: BindingScopeEnum.Singleton});
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

    public getSupportedCodeFixes(fixes: string[]) {
        return fixes;
    }

    public dispose() {
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
