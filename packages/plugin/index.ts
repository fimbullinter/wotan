/// <reference types="typescript/lib/tsserverlibrary" />

import mockRequire = require('mock-require');
import path = require('path');
import { Container, BindingScopeEnum } from 'inversify';

const alreadyWrapped = Symbol();

const init: ts.server.PluginModuleFactory = ({typescript}) => {
    return {
        create(info) {
            if (nothingToDoHere(info.languageService)) {
                info.project.projectService.logger.info('plugin is already set up in this project');
                return info.languageService;
            }
            // TODO use info.config
            info.project.projectService.logger.info('setting up plugin');
            mockRequire('typescript', typescript); // force every library to use the TypeScript version of the LanguageServer
            // use a map to store previously found failues
            // WeakMap allows releasing failures when the file is updated
            const failuresForFile = new WeakMap<ts.SourceFile, ReadonlyArray<import('@fimbul/wotan').Failure>>();
            const directoryToLinter = new Map<string, typeof import('@fimbul/wotan') | null>();
            return createProxy(info.languageService, {
                dispose() {
                    // TODO clean up after ourselves
                    return info.languageService.dispose();
                },
                getSemanticDiagnostics(fileName) {
                    info.project.projectService.logger.info(`called getSemanticDiagnostics: ${fileName}`);
                    let diagnostics = info.languageService.getSemanticDiagnostics(fileName);
                    const program = info.languageService.getProgram()!;
                    const file = program.getSourceFile(fileName);
                    if (file !== undefined) {
                        const library = loadLibrary(fileName, directoryToLinter, info.serverHost, info.project.projectService.logger);
                        if (library != undefined) {
                            const failures = getFailures(library, file, program);
                            failuresForFile.set(file, failures);
                            diagnostics = diagnostics.concat(failures.map((f) => failureToDiagnostic(f, file, typescript.DiagnosticCategory)));
                        }
                    }

                    return diagnostics;
                },
                getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences) {
                    info.project.projectService.logger.info(`called getCodeFixesAtPosition: ${fileName} ${start}-${end} [${errorCodes}]`);
                    return info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences);
                },
            });
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

function loadLibrary(f: string, cache: Map<string, typeof import('@fimbul/wotan') | null>, host: ts.System, logger: ts.server.Logger): typeof import('@fimbul/wotan') | null {
    f = path.dirname(f);
    while (path.basename(f) === 'node_modules')
        f = path.dirname(f);
    let result = cache.get(f);
    if (result === undefined) {
        const moduleDirectory = f + '/node_modules/@fimbul/wotan';
        if (host.directoryExists(moduleDirectory)) {
            try {
                result = <typeof import('@fimbul/wotan')>require(moduleDirectory);
            } catch (e) {
                logger.info(`failed to load linter from '${moduleDirectory}': ${e && e.message}`);
                result = null;
            }
        } else {
            const parent = path.dirname(f);
            if (parent === f) {
                result = null;
            } else {
                result = loadLibrary(parent, cache, host, logger);
            }
        }
        cache.set(f, result);
    }
    return result;
}

function getFailures(library: typeof import('@fimbul/wotan'), file: ts.SourceFile, program: ts.Program) {
    // TODO load .fimbullinter.yaml and
    //  use it to load plugin modules
    //  use include and exclude options
    //  use config option
    // TODO guard with try-catch to avoid completely sabotaging semantic diagnostics
    // TODO use CancellationToken to abort if necessary
    // TODO only lint user code
    const container = new Container({defaultScope: BindingScopeEnum.Singleton});
    container.load(library.createCoreModule({}), library.createDefaultModule()); // TODO pass global options
    const configManager = container.get(library.ConfigurationManager);
    const config = configManager.find(file.fileName);
    const effectiveConfig = config && configManager.reduce(config, file.fileName);
    if (effectiveConfig === undefined)
        return [];
    const linter = container.get(library.Linter);
    return linter.lintFile(<import('typescript').SourceFile>file, effectiveConfig, <import('typescript').Program>program);
}

function failureToDiagnostic(failure: import('@fimbul/wotan').Failure, sourceFile: ts.SourceFile, category: typeof import('typescript/lib/tsserverlibrary').DiagnosticCategory): ts.Diagnostic {
    return {
        category: failure.severity === 'error' ? category.Error : category.Warning,
        code: <any>failure.ruleName,
        file: sourceFile,
        source: 'wotan',
        messageText: failure.message,
        start: failure.start.position,
        length: failure.end.position - failure.start.position,
    }
}
