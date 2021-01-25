import { injectable } from 'inversify';
import * as ts from 'typescript';
import { DependencyResolver, DependencyResolverFactory } from './dependency-resolver';
import { resolveCachedResult, djb2 } from './utils';
import bind from 'bind-decorator';
import { EffectiveConfiguration, Finding, ReducedConfiguration } from '@fimbul/ymir';
import debug = require('debug');
import { ProjectHost } from './project-host';
import { isCompilerOptionEnabled } from 'tsutils';
import { StatePersistence } from './state-persistence';
import * as path from 'path';

const log = debug('wotan:programState');

export interface StaticProgramState {
    // TODO add linter version
    /** TypeScript version */
    readonly ts: string;
    /** Hash of compilerOptions */
    readonly options: string;
    /** Maps filename to index in 'files' array */
    readonly lookup: Readonly<Record<string, number>>;
    /** Index of files that affect global scope */
    readonly global: readonly number[];
    /** Information about all files in the program */
    readonly files: readonly StaticProgramState.FileState[];
}

export namespace StaticProgramState {
    export interface FileState {
        readonly hash: string;
        readonly dependencies: Readonly<Record<string, null | readonly number[]>>;
        readonly result?: readonly Finding[];
        readonly config?: string;
    }
}

@injectable()
export class ProgramStateFactory {
    constructor(private resolverFactory: DependencyResolverFactory, private statePersistence: StatePersistence) {}

    public create(program: ts.Program, host: ProjectHost, tsconfigPath: string) {
        return new ProgramState(program, this.resolverFactory.create(host, program), this.statePersistence, tsconfigPath);
    }
}

class ProgramState {
    private optionsHash = computeCompilerOptionsHash(this.program.getCompilerOptions());
    private assumeChangesOnlyAffectDirectDependencies =
        isCompilerOptionEnabled(this.program.getCompilerOptions(), 'assumeChangesOnlyAffectDirectDependencies');
    private fileHashes = new Map<string, string>();
    private fileResults = new Map<string, {readonly config: string, readonly result: ReadonlyArray<Finding>}>();
    private relativePathNames = new Map<string, string>();
    private _oldState: StaticProgramState | undefined;
    private recheckOldState = true;
    private projectDirectory = path.posix.dirname(this.project);
    private dependenciesUpToDate = new Map<string, boolean>();

    constructor(private program: ts.Program, private resolver: DependencyResolver, private statePersistence: StatePersistence, private project: string) {
        const oldState = this.statePersistence.loadState(project);
        this._oldState = (oldState?.ts !== ts.version || oldState.options !== this.optionsHash) ? undefined : oldState;
    }

    /** get old state if global files didn't change */
    private tryReuseOldState() {
        if (this._oldState === undefined || !this.recheckOldState)
            return this._oldState;
        const filesAffectingGlobalScope = this.resolver.getFilesAffectingGlobalScope();
        if (this._oldState.global.length !== filesAffectingGlobalScope.length)
            return this._oldState = undefined;
        const globalFilesWithHash = this.sortByHash(filesAffectingGlobalScope);
        for (let i = 0; i < globalFilesWithHash.length; ++i) {
            const index = this._oldState.global[i];
            if (
                globalFilesWithHash[i].hash !== this._oldState.files[index].hash ||
                !this.assumeChangesOnlyAffectDirectDependencies && !this.isFileUpToDate(globalFilesWithHash[i].fileName, index, this._oldState)
            )
                return this._oldState = undefined;
        }
        this.recheckOldState = false;
        return this._oldState;
    }

    public update(program: ts.Program, updatedFile: string) {
        this.resolver.update(program, updatedFile);
        this.fileHashes.delete(updatedFile);
        this.recheckOldState = true;
        this.dependenciesUpToDate = new Map();
    }

    private getFileHash(file: string) {
        return resolveCachedResult(this.fileHashes, file, this.computeFileHash);
    }

    @bind
    private computeFileHash(file: string) {
        return '' + djb2(this.program.getSourceFile(file)!.text);
    }

    private getRelativePath(fileName: string) {
        return resolveCachedResult(this.relativePathNames, fileName, this.makeRelativePath);
    }

    @bind
    private makeRelativePath(fileName: string) {
        return path.posix.relative(this.projectDirectory, fileName);
    }

    public getUpToDateResult(fileName: string, config: ReducedConfiguration) {
        const oldState = this.tryReuseOldState();
        if (oldState === undefined)
            return;
        const relative = this.getRelativePath(fileName);
        if (!(relative in oldState.lookup))
            return;
        const index = oldState.lookup[relative];
        const old = oldState.files[index];
        if (
            old.result === undefined ||
            old.config !== '' + djb2(JSON.stringify(stripConfig(config))) ||
            old.hash !== this.getFileHash(fileName) ||
            !this.isFileUpToDate(fileName, index, oldState)
        )
            return;
        log('reusing state for %s', fileName);
        return old.result;
    }

    public setFileResult(fileName: string, config: ReducedConfiguration, result: ReadonlyArray<Finding>) {
        this.fileResults.set(fileName, {result, config: '' + djb2(JSON.stringify(stripConfig(config)))});
    }

    private isFileUpToDate(fileName: string, index: number, oldState: StaticProgramState) {
        const fileNameQueue = [fileName];
        const stateQueue = [index];
        const childCounts = [];
        const circularDependenciesQueue: number[] = [];
        const cycles: string[][] = [];
        while (true) {
            fileName = fileNameQueue[fileNameQueue.length - 1];
            switch (this.dependenciesUpToDate.get(fileName)) {
                case false:
                    return this.markSelfAndParentsAsOutdated(fileNameQueue, childCounts);
                case undefined: {
                    let earliestCircularDependency = Number.MAX_SAFE_INTEGER;
                    let childCount = 0;

                    processDeps: {
                        for (const cycle of cycles) {
                            if (cycle.includes(fileName)) {
                                // we already know this is a circular dependency, don't continue with this one and simply mark the parent as circular
                                earliestCircularDependency = findCircularDependencyOfCycle(fileNameQueue, childCounts, circularDependenciesQueue, cycle);
                                break processDeps;
                            }
                        }
                        const old = oldState.files[stateQueue[stateQueue.length - 1]];
                        const dependencies = this.resolver.getDependencies(fileName);
                        const keys = Object.keys(old.dependencies);

                        if (dependencies.size !== keys.length)
                            return this.markSelfAndParentsAsOutdated(fileNameQueue, childCounts);
                        for (const key of keys) {
                            let newDeps = dependencies.get(key);
                            if (newDeps === undefined)
                                return this.markSelfAndParentsAsOutdated(fileNameQueue, childCounts); // external references have changed
                            const oldDeps = old.dependencies[key];
                            if (oldDeps === null) {
                                if (newDeps !== null)
                                    return this.markSelfAndParentsAsOutdated(fileNameQueue, childCounts);
                                continue;
                            }
                            if (newDeps === null)
                                return this.markSelfAndParentsAsOutdated(fileNameQueue, childCounts);
                            newDeps = Array.from(new Set(newDeps));
                            if (newDeps.length !== oldDeps.length)
                                return this.markSelfAndParentsAsOutdated(fileNameQueue, childCounts);
                            const newDepsWithHash = this.sortByHash(newDeps);
                            for (let i = 0; i < newDepsWithHash.length; ++i) {
                                const oldDepState = oldState.files[oldDeps[i]];
                                if (newDepsWithHash[i].hash !== oldDepState.hash)
                                    return this.markSelfAndParentsAsOutdated(fileNameQueue, childCounts);
                                if (!this.assumeChangesOnlyAffectDirectDependencies) {
                                    const indexInQueue = findParent(stateQueue, childCounts, oldDeps[i]);
                                    if (indexInQueue === -1) {
                                        // no circular dependency
                                        fileNameQueue.push(newDepsWithHash[i].fileName);
                                        stateQueue.push(oldDeps[i]);
                                        ++childCount;
                                    } else if (indexInQueue < earliestCircularDependency && newDepsWithHash[i].fileName !== fileName){
                                        earliestCircularDependency = indexInQueue;
                                    }
                                }
                            }
                        }
                    }

                    if (earliestCircularDependency === Number.MAX_SAFE_INTEGER) {
                        this.dependenciesUpToDate.set(fileName, true);
                    } else {
                        const parentCircularDep = circularDependenciesQueue[circularDependenciesQueue.length - 1];
                        if (parentCircularDep === Number.MAX_SAFE_INTEGER) {
                            cycles.push([fileName]);
                        } else {
                            cycles[cycles.length - 1].push(fileName);
                        }
                        if (earliestCircularDependency < parentCircularDep)
                            circularDependenciesQueue[circularDependenciesQueue.length - 1] = earliestCircularDependency;
                    }
                    if (childCount !== 0) {
                        childCounts.push(childCount);
                        circularDependenciesQueue.push(earliestCircularDependency);
                        continue;
                    }
                }
            }

            fileNameQueue.pop();
            stateQueue.pop();
            if (fileNameQueue.length === 0)
                return true;

            while (--childCounts[childCounts.length - 1] === 0) {
                childCounts.pop();
                stateQueue.pop();
                fileName = fileNameQueue.pop()!;
                const earliestCircularDependency = circularDependenciesQueue.pop()!;
                if (earliestCircularDependency >= stateQueue.length) {
                    this.dependenciesUpToDate.set(fileName, true); // cycle ends here
                    if (earliestCircularDependency !== Number.MAX_SAFE_INTEGER)
                        for (const f of cycles.pop()!)
                            this.dependenciesUpToDate.set(f, true); // update result for all files that had a circular dependency on this one
                } else {
                    const parentCircularDep = circularDependenciesQueue[circularDependenciesQueue.length - 1];
                    if (parentCircularDep === Number.MAX_SAFE_INTEGER) {
                        cycles[cycles.length - 1].push(fileName); // parent had no cycle, keep the existing one
                    } else if (!cycles[cycles.length - 1].includes(fileName)) {
                        cycles[cycles.length - 2].push(fileName, ...cycles.pop()!); // merge cycles
                    }
                    if (earliestCircularDependency < circularDependenciesQueue[circularDependenciesQueue.length - 1])
                        circularDependenciesQueue[circularDependenciesQueue.length - 1] = earliestCircularDependency;
                }
                if (fileNameQueue.length === 0)
                    return true;
            }
        }
    }

    private markSelfAndParentsAsOutdated(fileNameQueue: readonly string[], childCounts: readonly number[]) {
        this.dependenciesUpToDate.set(fileNameQueue[0], false);
        for (let i = 0, current = 0; i < childCounts.length; ++i) {
            current += childCounts[i];
            this.dependenciesUpToDate.set(fileNameQueue[current], false);
        }
        return false;
    }

    public save() {
        this.statePersistence.saveState(this.project, this.aggregate());
    }

    private aggregate(): StaticProgramState {
        const oldState = this.tryReuseOldState();
        const lookup: Record<string, number> = {};
        const mapToIndex = ({fileName}: {fileName: string}) => lookup[this.relativePathNames.get(fileName)!];
        const mapDependencies = (dependencies: ReadonlyMap<string, null | readonly string[]>) => {
            const result: Record<string, null | number[]> = {};
            for (const [key, f] of dependencies)
                result[key] = f === null
                    ? null
                    : this.sortByHash(Array.from(new Set(f))).map(mapToIndex);
            return result;
        };
        const files: StaticProgramState.FileState[] = [];
        const sourceFiles = this.program.getSourceFiles();
        for (let i = 0; i < sourceFiles.length; ++i)
            lookup[this.getRelativePath(sourceFiles[i].fileName)] = i;
        for (const file of sourceFiles) {
            const relativePath = this.relativePathNames.get(file.fileName)!;
            // TODO need to check each file individually for up to date
            files.push({
                ...oldState && relativePath in oldState.lookup && oldState.files[oldState.lookup[relativePath]],
                hash: this.getFileHash(file.fileName),
                dependencies: mapDependencies(this.resolver.getDependencies(file.fileName)),
                ...this.fileResults.get(file.fileName),
            });
        }
        return {
            ts: ts.version,
            files,
            lookup,
            global: this.sortByHash(this.resolver.getFilesAffectingGlobalScope()).map(mapToIndex),
            options: this.optionsHash,
        };
    }

    private sortByHash(fileNames: readonly string[]) {
        return fileNames
            .map((f) => ({fileName: f, hash: this.getFileHash(f)}))
            .sort(compareHashKey);
    }
}

function findCircularDependencyOfCycle(fileNameQueue: readonly string[], childCounts: readonly number[], circularDependencies: readonly number[], cycle: readonly string[]) {
    for (let i = 0, current = 0; i < childCounts.length; ++i) {
        current += childCounts[i];
        const dep = circularDependencies[current];
        if (dep !== Number.MAX_SAFE_INTEGER && cycle.includes(fileNameQueue[current]))
            return dep;
    }
    throw new Error('should never happen');
}

function findParent(stateQueue: readonly number[], childCounts: readonly number[], needle: number): number {
    if (stateQueue[0] === needle)
        return 0;
    for (let i = 0, current = 0; i < childCounts.length; ++i) {
        current += childCounts[i];
        if (stateQueue[current] === needle)
            return current;
    }
    return -1;
}

function compareHashKey(a: {hash: string}, b: {hash: string}) {
    return a.hash < b.hash ? -1 : a.hash === b.hash ? 0 : 1;
}

function computeCompilerOptionsHash(options: ts.CompilerOptions) {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(options).sort())
        if (isKnownCompilerOption(key))
            obj[key] = options[key]; // TODO make paths relative and use correct casing
    return '' + djb2(JSON.stringify(obj));
}

function isKnownCompilerOption(option: string): boolean {
    type KnownOptions =
        {[K in keyof ts.CompilerOptions]: string extends K ? never : K} extends {[K in keyof ts.CompilerOptions]: infer P} ? P : never;
    const o = <KnownOptions>option;
    switch (o) {
        case 'allowJs':
        case 'allowSyntheticDefaultImports':
        case 'allowUmdGlobalAccess':
        case 'allowUnreachableCode':
        case 'allowUnusedLabels':
        case 'alwaysStrict':
        case 'assumeChangesOnlyAffectDirectDependencies':
        case 'baseUrl':
        case 'charset':
        case 'checkJs':
        case 'composite':
        case 'declaration':
        case 'declarationDir':
        case 'declarationMap':
        case 'disableReferencedProjectLoad':
        case 'disableSizeLimit':
        case 'disableSourceOfProjectReferenceRedirect':
        case 'disableSolutionSearching':
        case 'downlevelIteration':
        case 'emitBOM':
        case 'emitDeclarationOnly':
        case 'emitDecoratorMetadata':
        case 'esModuleInterop':
        case 'experimentalDecorators':
        case 'forceConsistentCasingInFileNames':
        case 'importHelpers':
        case 'importsNotUsedAsValues':
        case 'incremental':
        case 'inlineSourceMap':
        case 'inlineSources':
        case 'isolatedModules':
        case 'jsx':
        case 'jsxFactory':
        case 'jsxFragmentFactory':
        case 'jsxImportSource':
        case 'keyofStringsOnly':
        case 'lib':
        case 'locale':
        case 'mapRoot':
        case 'maxNodeModuleJsDepth':
        case 'module':
        case 'moduleResolution':
        case 'newLine':
        case 'noEmit':
        case 'noEmitHelpers':
        case 'noEmitOnError':
        case 'noErrorTruncation':
        case 'noFallthroughCasesInSwitch':
        case 'noImplicitAny':
        case 'noImplicitReturns':
        case 'noImplicitThis':
        case 'noImplicitUseStrict':
        case 'noLib':
        case 'noPropertyAccessFromIndexSignature':
        case 'noResolve':
        case 'noStrictGenericChecks':
        case 'noUncheckedIndexedAccess':
        case 'noUnusedLocals':
        case 'noUnusedParameters':
        case 'out':
        case 'outDir':
        case 'outFile':
        case 'paths':
        case 'preserveConstEnums':
        case 'preserveSymlinks':
        case 'project':
        case 'reactNamespace':
        case 'removeComments':
        case 'resolveJsonModule':
        case 'rootDir':
        case 'rootDirs':
        case 'skipDefaultLibCheck':
        case 'skipLibCheck':
        case 'sourceMap':
        case 'sourceRoot':
        case 'strict':
        case 'strictBindCallApply':
        case 'strictFunctionTypes':
        case 'strictNullChecks':
        case 'strictPropertyInitialization':
        case 'stripInternal':
        case 'suppressExcessPropertyErrors':
        case 'suppressImplicitAnyIndexErrors':
        case 'target':
        case 'traceResolution':
        case 'tsBuildInfoFile':
        case 'typeRoots':
        case 'types':
        case 'useDefineForClassFields':
            return true;
        default:
            type AssertNever<T extends never> = T;
            return <AssertNever<typeof o>>false;
    }
}

// TODO this should probably happen in runner
function stripConfig(config: ReducedConfiguration) {
    return {
        rules: mapToObject(config.rules, stripRule),
        settings: mapToObject(config.settings, identity),
    };
}

function mapToObject<T, U>(map: ReadonlyMap<string, T>, transform: (v: T) => U) {
    const result: Record<string, U> = {};
    for (const [key, value] of map)
        result[key] = transform(value);
    return result;
}

function identity<T>(v: T) {
    return v;
}

function stripRule({rulesDirectories, ...rest}: EffectiveConfiguration.RuleConfig) {
    return rest;
}
