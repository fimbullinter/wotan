import { injectable } from 'inversify';
import * as ts from 'typescript';
import { DependencyResolver, DependencyResolverFactory, DependencyResolverProgram } from './dependency-resolver';
import { resolveCachedResult, djb2, arraysAreEqual } from './utils';
import bind from 'bind-decorator';
import { Finding, ReducedConfiguration } from '@fimbul/ymir';
import debug = require('debug');

const log = debug('wotan:programState');

export interface StaticProgramState {
    optionsHash: string;
    filesAffectingGlobalScope: ReadonlyArray<string>;
    files: Record<string, {
        hash: string,
        dependencies: ReadonlyArray<string>,
        result?: ReadonlyArray<Finding>,
        configHash?: string,
    }>;
}

@injectable()
export class ProgramStateFactory {
    constructor(private resolverFactory: DependencyResolverFactory) {}

    public create(program: DependencyResolverProgram, host: ts.CompilerHost) {
        return new ProgramState(program, this.resolverFactory.create(host, program));
    }
}

class ProgramState {
    private optionsHash = computeCompilerOptionsHash(this.program.getCompilerOptions());
    private fileHashes = new Map<string, string>();
    private knownOutdated: boolean | undefined = undefined;
    private fileResults = new Map<string, {configHash: string, result: ReadonlyArray<Finding>}>();
    constructor(private program: DependencyResolverProgram, private resolver: DependencyResolver) {}

    public update(program: DependencyResolverProgram, updatedFiles: Iterable<string>) {
        this.knownOutdated = undefined;
        this.resolver.update(program, updatedFiles);
        for (const file of updatedFiles)
            this.fileHashes.delete(file);
    }

    private getFileHash(file: string) {
        return resolveCachedResult(this.fileHashes, file, this.computeFileHash);
    }

    @bind
    private computeFileHash(file: string) {
        return '' + djb2(this.program.getSourceFile(file)!.text);
    }

    public getUpToDateResult(fileName: string, config: ReducedConfiguration, oldState?: StaticProgramState) {
        if (!this.isUpToDate(fileName, config, oldState))
            return;
        log('reusing state for %s', fileName);
        return oldState!.files[fileName].result;
    }

    public setFileResult(fileName: string, config: ReducedConfiguration, result: ReadonlyArray<Finding>) {
        this.fileResults.set(fileName, {result, configHash: '' + djb2(JSON.stringify(config))}); // TODO absolute paths
    }

    public isUpToDate(fileName: string, config: ReducedConfiguration, oldState?: StaticProgramState) {
        if (oldState === undefined)
            return false;
        if (this.knownOutdated === undefined)
            this.knownOutdated = this.optionsHash !== oldState.optionsHash ||
                !arraysAreEqual(oldState.filesAffectingGlobalScope, this.resolver.getFilesAffectingGlobalScope());
        if (this.knownOutdated)
            return false;
        const old = oldState.files[fileName];
        if (old === undefined || old.result === undefined || old.configHash !== '' + djb2(JSON.stringify(config))) // TODO config contains absolute paths
            return false;
        return this.isFileUpToDate(fileName, oldState, new Set());
    }

    private isFileUpToDate(fileName: string, oldState: StaticProgramState, seen: Set<string>) {
        seen.add(fileName);
        const old = oldState.files[fileName]; // TODO use relative file names?
        if (old === undefined || old.hash !== this.getFileHash(fileName))
            return false;
        const dependencies = this.resolver.getDependencies(fileName);
        if (!arraysAreEqual(dependencies, old.dependencies))
            return false;
        for (const dep of dependencies)
            if (!seen.has(dep) && !this.isFileUpToDate(dep, oldState, seen))
                return false;
        return true;
    }

    public aggregate(oldState?: StaticProgramState): StaticProgramState {
        const files: StaticProgramState['files'] = {};
        for (const file of this.program.getSourceFiles())
            files[file.fileName] = {
                ...oldState && oldState.files[file.fileName],
                hash: this.getFileHash(file.fileName),
                dependencies: this.resolver.getDependencies(file.fileName),
                ...this.fileResults.get(file.fileName),
            };
        return {
            files,
            optionsHash: this.optionsHash,
            filesAffectingGlobalScope: this.resolver.getFilesAffectingGlobalScope(),
        };
    }
}

function computeCompilerOptionsHash(options: ts.CompilerOptions) {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(options).sort())
        if (isKnownCompilerOption(key))
            obj[key] = options[key];
    return '' + djb2(JSON.stringify(obj));
}

function isKnownCompilerOption(option: string): boolean {
    type KnownOptions =
        {[K in keyof ts.CompilerOptions]: string extends K ? never : K} extends {[K in keyof ts.CompilerOptions]: infer P} ? P : never;
    const o = <KnownOptions>option;
    switch (o) {
        case 'allowJs': //
        case 'allowSyntheticDefaultImports':
        case 'allowUnreachableCode':
        case 'allowUnusedLabels':
        case 'alwaysStrict':
        case 'baseUrl':
        case 'charset':
        case 'checkJs':
        case 'composite':
        case 'declaration':
        case 'declarationDir': //
        case 'declarationMap': //
        case 'disableSizeLimit': //
        case 'downlevelIteration':
        case 'emitBOM': //
        case 'emitDeclarationOnly': //
        case 'emitDecoratorMetadata':
        case 'esModuleInterop':
        case 'experimentalDecorators':
        case 'forceConsistentCasingInFileNames':
        case 'importHelpers':
        case 'incremental': //
        case 'inlineSourceMap': //
        case 'inlineSources': //
        case 'isolatedModules':
        case 'jsx':
        case 'jsxFactory':
        case 'keyofStringsOnly':
        case 'lib':
        case 'locale':
        case 'mapRoot':
        case 'maxNodeModuleJsDepth':
        case 'module':
        case 'moduleResolution':
        case 'newLine': //
        case 'noEmit': //
        case 'noEmitHelpers': //
        case 'noEmitOnError': //
        case 'noErrorTruncation':
        case 'noFallthroughCasesInSwitch':
        case 'noImplicitAny':
        case 'noImplicitReturns':
        case 'noImplicitThis':
        case 'noImplicitUseStrict':
        case 'noLib':
        case 'noResolve':
        case 'noStrictGenericChecks':
        case 'noUnusedLocals':
        case 'noUnusedParameters':
        case 'out': //
        case 'outDir': //
        case 'outFile': //
        case 'paths':
        case 'preserveConstEnums': //
        case 'preserveSymlinks':
        case 'project': //
        case 'reactNamespace':
        case 'removeComments': //
        case 'resolveJsonModule':
        case 'rootDir':
        case 'rootDirs':
        case 'skipDefaultLibCheck':
        case 'skipLibCheck':
        case 'sourceMap': //
        case 'sourceRoot': //
        case 'strict':
        case 'strictBindCallApply':
        case 'strictFunctionTypes':
        case 'strictNullChecks':
        case 'strictPropertyInitialization':
        case 'stripInternal':
        case 'suppressExcessPropertyErrors':
        case 'suppressImplicitAnyIndexErrors':
        case 'target':
        case 'traceResolution': //
        case 'tsBuildInfoFile': //
        case 'typeRoots':
        case 'types':
            return true;
        default:
            type AssertNever<T extends never> = T;
            return <AssertNever<typeof o>>false;
    }
}
