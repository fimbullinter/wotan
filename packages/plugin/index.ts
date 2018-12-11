/// <reference types="typescript/lib/tsserverlibrary" />

import mockRequire = require('mock-require');
import { Container, BindingScopeEnum } from 'inversify';

const alreadyWrapped = Symbol();

const init: ts.server.PluginModuleFactory = ({typescript}) => {
    let config: Record<string, unknown>;
    return {
        onConfigurationChanged(newConfig) {
            config = newConfig;
        },
        create(info) {
            const project = info.project;
            const logger = project.projectService.logger;
            if (nothingToDoHere(info.languageService)) {
                logger.info('plugin is already set up in this project');
                return info.languageService;
            }
            if (info.serverHost.require === undefined) {
                logger.info("cannot load linter because ServerHost doesn't support `require`");
                return info.languageService;
            }
            mockRequire('typescript', typescript); // force every library to use the TypeScript version of the LanguageServer
            // TypeScript only allows language service plugins in node_modules next to itself or in a parent directory
            const required = info.serverHost.require(info.serverHost.getExecutingFilePath() + '/../../..', '@fimbul/wotan');
            if (required.error !== undefined) {
                logger.info(`failed to load linter: ${required.error.message}`);
                return info.languageService;
            }
            const library = <typeof import('@fimbul/wotan')>required.module;
            logger.info('setting up plugin');
            ({config} = info);
            // use a map to store previously found failues
            // WeakMap allows releasing failures when the file is updated
            const failuresForFile = new WeakMap<ts.SourceFile, ReadonlyArray<import('@fimbul/wotan').Failure>>();
            return createProxy(info.languageService, {
                dispose() {
                    // TODO clean up after ourselves
                    return info.languageService.dispose();
                },
                getSemanticDiagnostics(fileName) {
                    let diagnostics = info.languageService.getSemanticDiagnostics(fileName);
                    const program = info.languageService.getProgram()!;
                    const file = program.getSourceFile(fileName);
                    if (file !== undefined) {
                        logger.info(`started linting ${fileName}`);
                        try {
                            const failures = getFailures(file, program);
                            failuresForFile.set(file, failures);
                            diagnostics = diagnostics.concat(failures.map((failure) => ({
                                file,
                                category: failure.severity === 'error' && !config.displayErrorsAsWarnings
                                    ? typescript.DiagnosticCategory.Error
                                    : typescript.DiagnosticCategory.Warning,
                                code: <any>failure.ruleName,
                                source: 'wotan',
                                messageText: failure.message,
                                start: failure.start.position,
                                length: failure.end.position - failure.start.position,
                            })));
                            logger.info(`finished linting ${fileName}, found ${failures.length} failures`);
                        } catch (e) {
                            logger.info(`linting ${fileName} failed: ${e && e.message}`);
                        }
                    }
                    return diagnostics;
                },
                getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences) {
                    logger.info(`called getCodeFixesAtPosition: ${fileName} ${start}-${end} [${errorCodes}]`);
                    return info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences);
                },
            });

            function getFailures(file: ts.SourceFile, program: ts.Program) {
                // TODO load .fimbullinter.yaml and
                //  use it to load plugin modules
                //  use include and exclude options
                //  use config option
                // TODO use CancellationToken to abort if necessary
                const container = new Container({defaultScope: BindingScopeEnum.Singleton});
                container.bind(library.FileSystem).toConstantValue(new ProjectFileSystem(project));
                container.load(library.createCoreModule({}), library.createDefaultModule()); // TODO pass global options
                const fileFilter = container.get(library.FileFilterFactory).create({program, host: project});
                if (!fileFilter.filter(file))
                    return [];
                const configManager = container.get(library.ConfigurationManager);
                const config = configManager.find(file.fileName);
                const effectiveConfig = config && configManager.reduce(config, file.fileName);
                if (effectiveConfig === undefined)
                    return [];
                const linter = container.get(library.Linter);
                return linter.lintFile(file, effectiveConfig, program);
            }
        },
    };
};

export = init;

function createProxy(ls: any, overrides: Partial<ts.LanguageService>) {
    const proxy = Object.create(null);
    for (const method of Object.keys(ls))
        proxy[method] = method in overrides ? (<any>overrides)[method] : ls[method].bind(ls);
    proxy[alreadyWrapped] = () => true;
    return proxy;
}

function nothingToDoHere(ls: any): boolean {
    return typeof ls[alreadyWrapped] === 'function' && ls[alreadyWrapped]();
}

type FileSystem = import('@fimbul/wotan').FileSystem;

class ProjectFileSystem implements FileSystem {
    public realpath = this.project.realpath && ((f: string) => this.project.realpath!(f));
    constructor(private project: ts.server.Project) {}
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
        return this.project.useCaseSensitiveFileNames() ? f : f.toLowerCase();
    }
    public readFile(f: string) {
        const result = this.project.readFile(f);
        if (result === undefined)
            throw new Error('ENOENT');
        return result;
    }
    public readDirectory(dir: string) {
        return this.project.readDirectory(dir, undefined, undefined, ['*']);
    }
    public stat(f: string) {
        const isFile = this.project.fileExists(f)
            ? true
            : this.project.directoryExists(f)
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
