import { injectable } from 'inversify';
import * as ts from 'typescript';
import { DependencyResolver, DependencyResolverFactory } from './dependency-resolver';
import { resolveCachedResult, djb2 } from '../utils';
import bind from 'bind-decorator';
import { EffectiveConfiguration, Finding, ReducedConfiguration, StatePersistence, StaticProgramState } from '@fimbul/ymir';
import debug = require('debug');
import { ProjectHost } from '../project-host';
import { isCompilerOptionEnabled } from 'tsutils';
import * as path from 'path';

const log = debug('wotan:programState');

export interface ProgramState {
    update(program: ts.Program, updatedFile: string): void;
    getUpToDateResult(fileName: string, config: EffectiveConfiguration): readonly Finding[] | undefined;
    setFileResult(fileName: string, config: EffectiveConfiguration, result: readonly Finding[]): void;
    save(): void;
}

@injectable()
export class ProgramStateFactory {
    constructor(private resolverFactory: DependencyResolverFactory, private statePersistence: StatePersistence) {}

    public create(program: ts.Program, host: ProjectHost, tsconfigPath: string) {
        return new ProgramStateImpl(program, this.resolverFactory.create(host, program), this.statePersistence, tsconfigPath);
    }
}

interface FileResults {
    readonly config: string;
    readonly result: ReadonlyArray<Finding>;
}

const oldStateSymbol = Symbol('oldState');
class ProgramStateImpl implements ProgramState {
    private optionsHash = computeCompilerOptionsHash(this.program.getCompilerOptions());
    private assumeChangesOnlyAffectDirectDependencies =
        isCompilerOptionEnabled(this.program.getCompilerOptions(), 'assumeChangesOnlyAffectDirectDependencies');
    private fileHashes = new Map<string, string>();
    private fileResults = new Map<string, FileResults>();
    private relativePathNames = new Map<string, string>();
    private [oldStateSymbol]: StaticProgramState | undefined;
    private recheckOldState = true;
    private projectDirectory = path.posix.dirname(this.project);
    private dependenciesUpToDate = new Map<string, boolean>();

    constructor(
        private program: ts.Program,
        private resolver: DependencyResolver,
        private statePersistence: StatePersistence,
        private project: string,
    ) {
        const oldState = this.statePersistence.loadState(project);
        this[oldStateSymbol] = (oldState?.ts !== ts.version || oldState.options !== this.optionsHash) ? undefined : oldState;
    }

    /** get old state if global files didn't change */
    private tryReuseOldState() {
        const oldState = this[oldStateSymbol];
        if (oldState === undefined || !this.recheckOldState)
            return oldState;
        const filesAffectingGlobalScope = this.resolver.getFilesAffectingGlobalScope();
        if (oldState.global.length !== filesAffectingGlobalScope.length)
            return this[oldStateSymbol] = undefined;
        const globalFilesWithHash = this.sortByHash(filesAffectingGlobalScope);
        for (let i = 0; i < globalFilesWithHash.length; ++i) {
            const index = oldState.global[i];
            if (
                globalFilesWithHash[i].hash !== oldState.files[index].hash ||
                !this.assumeChangesOnlyAffectDirectDependencies &&
                !this.fileDependenciesUpToDate(globalFilesWithHash[i].fileName, index, oldState)
            )
                return this[oldStateSymbol] = undefined;
        }
        this.recheckOldState = false;
        return oldState;
    }

    public update(program: ts.Program, updatedFile: string) {
        this.program = program;
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
            !this.fileDependenciesUpToDate(fileName, index, oldState)
        )
            return;
        log('reusing state for %s', fileName);
        return old.result;
    }

    public setFileResult(fileName: string, config: ReducedConfiguration, result: ReadonlyArray<Finding>) {
        if (!this.isFileUpToDate(fileName)) {
            log('File %s is outdated, merging current state into old state', fileName);
            // we need to create a state where the file is up-to-date
            // so we replace the old state with the current state
            // this includes all results from old state that were still up-to-date and all file results if they were still valid
            this[oldStateSymbol] = this.aggregate();
            this.recheckOldState = false;
            this.fileResults = new Map();
            this.dependenciesUpToDate = new Map(this.program.getSourceFiles().map((f) => [f.fileName, true]));
        }
        this.fileResults.set(fileName, {result, config: '' + djb2(JSON.stringify(stripConfig(config)))});
    }

    private isFileUpToDate(fileName: string): boolean {
        const oldState = this.tryReuseOldState();
        if (oldState === undefined)
            return false;
        const relative = this.getRelativePath(fileName);
        if (!(relative in oldState.lookup))
            return false;
        const index = oldState.lookup[relative];
        return oldState.files[index].hash === this.getFileHash(fileName) &&
            this.fileDependenciesUpToDate(fileName, index, oldState);
    }

    private fileDependenciesUpToDate(fileName: string, index: number, oldState: StaticProgramState): boolean {
        const fileNameQueue = [fileName];
        const stateQueue = [index];
        const childCounts = [];
        const circularDependenciesQueue: number[] = [];
        const cycles: Array<Set<string>> = [];
        while (true) {
            fileName = fileNameQueue[fileNameQueue.length - 1];
            switch (this.dependenciesUpToDate.get(fileName)) {
                case false:
                    return markSelfAndParentsAsOutdated(fileNameQueue, childCounts, this.dependenciesUpToDate);
                case undefined: {
                    let earliestCircularDependency = Number.MAX_SAFE_INTEGER;
                    let childCount = 0;

                    for (const cycle of cycles) {
                        if (cycle.has(fileName)) {
                            // we already know this is a circular dependency, skip this one and simply mark the parent as circular
                            earliestCircularDependency =
                                findCircularDependencyOfCycle(fileNameQueue, childCounts, circularDependenciesQueue, cycle);
                            break;
                        }
                    }
                    if (earliestCircularDependency !== Number.MAX_SAFE_INTEGER) {
                        const old = oldState.files[stateQueue[stateQueue.length - 1]];
                        const dependencies = this.resolver.getDependencies(fileName);
                        const keys = Object.keys(old.dependencies);

                        if (dependencies.size !== keys.length)
                            return markSelfAndParentsAsOutdated(fileNameQueue, childCounts, this.dependenciesUpToDate);
                        for (const key of keys) {
                            let newDeps = dependencies.get(key);
                            if (newDeps === undefined)
                                return markSelfAndParentsAsOutdated(fileNameQueue, childCounts, this.dependenciesUpToDate);
                            const oldDeps = old.dependencies[key];
                            if (oldDeps === null) {
                                if (newDeps !== null)
                                    return markSelfAndParentsAsOutdated(fileNameQueue, childCounts, this.dependenciesUpToDate);
                                continue;
                            }
                            if (newDeps === null)
                                return markSelfAndParentsAsOutdated(fileNameQueue, childCounts, this.dependenciesUpToDate);
                            newDeps = Array.from(new Set(newDeps));
                            if (newDeps.length !== oldDeps.length)
                                return markSelfAndParentsAsOutdated(fileNameQueue, childCounts, this.dependenciesUpToDate);
                            const newDepsWithHash = this.sortByHash(newDeps);
                            for (let i = 0; i < newDepsWithHash.length; ++i) {
                                const oldDepState = oldState.files[oldDeps[i]];
                                if (newDepsWithHash[i].hash !== oldDepState.hash)
                                    return markSelfAndParentsAsOutdated(fileNameQueue, childCounts, this.dependenciesUpToDate);
                                if (!this.assumeChangesOnlyAffectDirectDependencies) {
                                    const indexInQueue = findParent(stateQueue, childCounts, oldDeps[i]);
                                    if (indexInQueue === -1) {
                                        // no circular dependency
                                        fileNameQueue.push(newDepsWithHash[i].fileName);
                                        stateQueue.push(oldDeps[i]);
                                        ++childCount;
                                    } else if (indexInQueue < earliestCircularDependency && newDepsWithHash[i].fileName !== fileName) {
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
                            cycles.push(new Set([fileName]));
                        } else {
                            cycles[cycles.length - 1].add(fileName);
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
                            this.dependenciesUpToDate.set(f, true); // update result for files that had a circular dependency on this one
                } else {
                    const parentCircularDep = circularDependenciesQueue[circularDependenciesQueue.length - 1];
                    if (parentCircularDep === Number.MAX_SAFE_INTEGER) {
                        cycles[cycles.length - 1].add(fileName); // parent had no cycle, keep the existing one
                    } else if (!cycles[cycles.length - 1].has(fileName)) {
                        const currentCycle = cycles.pop()!;
                        const previousCycle = cycles[cycles.length - 1];
                        previousCycle.add(fileName);
                        for (const f of currentCycle)
                            previousCycle.add(f); // merge cycles
                    }
                    if (earliestCircularDependency < circularDependenciesQueue[circularDependenciesQueue.length - 1])
                        circularDependenciesQueue[circularDependenciesQueue.length - 1] = earliestCircularDependency;
                }
                if (fileNameQueue.length === 0)
                    return true;
            }
        }
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
            let results = this.fileResults.get(file.fileName);
            if (results === undefined && oldState !== undefined && relativePath in oldState.lookup) {
                const old = oldState.files[oldState.lookup[relativePath]];
                if (old.result !== undefined)
                    results = <FileResults>old;
            }
            if (results !== undefined && !this.isFileUpToDate(file.fileName)) {
                log('Discarding outdated results for %s', file.fileName);
                results = undefined;
            }
            files.push({
                ...results,
                hash: this.getFileHash(file.fileName),
                dependencies: mapDependencies(this.resolver.getDependencies(file.fileName)),
            });
        }
        return {
            files,
            lookup,
            ts: ts.version,
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

function findCircularDependencyOfCycle(
    fileNameQueue: readonly string[],
    childCounts: readonly number[],
    circularDependencies: readonly number[],
    cycle: ReadonlySet<string>,
) {
    if (circularDependencies[0] !== Number.MAX_SAFE_INTEGER && cycle.has(fileNameQueue[0]))
        return circularDependencies[0];
    for (let i = 0, current = 0; i < childCounts.length; ++i) {
        current += childCounts[i];
        const dep = circularDependencies[current];
        if (dep !== Number.MAX_SAFE_INTEGER && cycle.has(fileNameQueue[current]))
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

function markSelfAndParentsAsOutdated(fileNameQueue: readonly string[], childCounts: readonly number[], results: Map<string, boolean>) {
    results.set(fileNameQueue[0], false);
    for (let i = 0, current = 0; i < childCounts.length; ++i) {
        current += childCounts[i];
        results.set(fileNameQueue[current], false);
    }
    return false;
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
    type KnownOptions = // tslint:disable-next-line:no-unused
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

function stripRule({rulesDirectories: _ignored, ...rest}: EffectiveConfiguration.RuleConfig) {
    return rest;
}
