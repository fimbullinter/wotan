import { injectable } from 'inversify';
import * as ts from 'typescript';
import { DependencyResolver, DependencyResolverFactory, DependencyResolverHost } from './dependency-resolver';
import { resolveCachedResult, djb2, unixifyPath, emptyArray } from '../utils';
import bind from 'bind-decorator';
import { ContentId, ContentIdHost, Finding, StatePersistence, StaticProgramState } from '@fimbul/ymir';
import debug = require('debug');
import { isCompilerOptionEnabled } from 'tsutils';
import * as path from 'path';

const log = debug('wotan:programState');

export interface ProgramState {
    update(program: ts.Program, updatedFile: string): void;
    getUpToDateResult(fileName: string, configHash: string): readonly Finding[] | undefined;
    setFileResult(fileName: string, configHash: string, result: readonly Finding[]): void;
    save(): void;
}

@injectable()
export class ProgramStateFactory {
    constructor(
        private resolverFactory: DependencyResolverFactory,
        private statePersistence: StatePersistence,
        private contentId: ContentId,
    ) {}

    public create(program: ts.Program, host: ProgramStateHost & DependencyResolverHost, tsconfigPath: string) {
        return new ProgramStateImpl(
            host,
            program,
            this.resolverFactory.create(host, program),
            this.statePersistence,
            this.contentId,
            tsconfigPath,
        );
    }
}

export type ProgramStateHost = Pick<ts.CompilerHost, 'useCaseSensitiveFileNames'>;

interface FileResults {
    readonly config: string;
    readonly result: ReadonlyArray<Finding>;
}

const enum DependencyState {
    Unknown = 0,
    Outdated = 1,
    Ok = 2,
}

const STATE_VERSION = 1;

const oldStateSymbol = Symbol('oldState');
class ProgramStateImpl implements ProgramState {
    private projectDirectory = unixifyPath(path.dirname(this.project));
    private caseSensitive = this.host.useCaseSensitiveFileNames();
    private canonicalProjectDirectory = this.caseSensitive ? this.projectDirectory : this.projectDirectory.toLowerCase();
    private optionsHash = computeCompilerOptionsHash(this.program.getCompilerOptions(), this.projectDirectory);
    private assumeChangesOnlyAffectDirectDependencies =
        isCompilerOptionEnabled(this.program.getCompilerOptions(), 'assumeChangesOnlyAffectDirectDependencies');
    private contentIds = new Map<string, string>();
    private fileResults = new Map<string, FileResults>();
    private relativePathNames = new Map<string, string>();
    private [oldStateSymbol]: StaticProgramState | undefined;
    private recheckOldState = true;
    private dependenciesUpToDate: Uint8Array;

    // TODO this can be removed once ProjectHost correctly reflects applied fixed in readFile
    private contentIdHost: ContentIdHost = {
        readFile: (f) => this.program.getSourceFile(f)?.text,
    };

    constructor(
        private host: ProgramStateHost,
        private program: ts.Program,
        private resolver: DependencyResolver,
        private statePersistence: StatePersistence,
        private contentId: ContentId,
        private project: string,
    ) {
        const oldState = this.statePersistence.loadState(project);
        if (oldState?.v !== STATE_VERSION || oldState.ts !== ts.version || oldState.options !== this.optionsHash) {
            this[oldStateSymbol] = undefined;
            this.dependenciesUpToDate = new Uint8Array(0);
        } else {
            this[oldStateSymbol] = this.remapFileNames(oldState);
            this.dependenciesUpToDate = new Uint8Array(oldState.files.length);
        }
    }

    /** get old state if global files didn't change */
    private tryReuseOldState() {
        const oldState = this[oldStateSymbol];
        if (oldState === undefined || !this.recheckOldState)
            return oldState;
        const filesAffectingGlobalScope = this.resolver.getFilesAffectingGlobalScope();
        if (oldState.global.length !== filesAffectingGlobalScope.length)
            return this[oldStateSymbol] = undefined;
        const globalFilesWithId = this.sortById(filesAffectingGlobalScope);
        for (let i = 0; i < globalFilesWithId.length; ++i) {
            const index = oldState.global[i];
            if (
                globalFilesWithId[i].id !== oldState.files[index].id ||
                !this.assumeChangesOnlyAffectDirectDependencies &&
                !this.fileDependenciesUpToDate(globalFilesWithId[i].fileName, index, oldState)
            )
                return this[oldStateSymbol] = undefined;
        }
        this.recheckOldState = false;
        return oldState;
    }

    public update(program: ts.Program, updatedFile: string) {
        this.program = program;
        this.resolver.update(program, updatedFile);
        this.contentIds.delete(updatedFile);
        this.recheckOldState = true;
        this.dependenciesUpToDate.fill(DependencyState.Unknown);
    }

    private getContentId(file: string) {
        return resolveCachedResult(this.contentIds, file, this.computeContentId);
    }

    @bind
    private computeContentId(file: string) {
        return this.contentId.forFile(file, this.contentIdHost);
    }

    private getRelativePath(fileName: string) {
        return resolveCachedResult(this.relativePathNames, fileName, this.makeRelativePath);
    }

    @bind
    private makeRelativePath(fileName: string) {
        return unixifyPath(path.relative(this.canonicalProjectDirectory, this.caseSensitive ? fileName : fileName.toLowerCase()));
    }

    public getUpToDateResult(fileName: string, configHash: string) {
        const oldState = this.tryReuseOldState();
        if (oldState === undefined)
            return;
        const index = this.lookupFileIndex(fileName, oldState);
        if (index === undefined)
            return;
        const old = oldState.files[index];
        if (
            old.result === undefined ||
            old.config !== configHash ||
            old.id !== this.getContentId(fileName) ||
            !this.fileDependenciesUpToDate(fileName, index, oldState)
        )
            return;
        log('reusing state for %s', fileName);
        return old.result;
    }

    public setFileResult(fileName: string, configHash: string, result: ReadonlyArray<Finding>) {
        if (!this.isFileUpToDate(fileName)) {
            log('File %s is outdated, merging current state into old state', fileName);
            // we need to create a state where the file is up-to-date
            // so we replace the old state with the current state
            // this includes all results from old state that are still up-to-date and all file results if they are still valid
            const newState = this[oldStateSymbol] = this.aggregate();
            this.recheckOldState = false;
            this.fileResults = new Map();
            this.dependenciesUpToDate = new Uint8Array(newState.files.length).fill(DependencyState.Ok);
        }
        this.fileResults.set(fileName, {result, config: configHash});
    }

    private isFileUpToDate(fileName: string): boolean {
        const oldState = this.tryReuseOldState();
        if (oldState === undefined)
            return false;
        const index = this.lookupFileIndex(fileName, oldState);
        if (index === undefined || oldState.files[index].id !== this.getContentId(fileName))
            return false;
        switch (<DependencyState>this.dependenciesUpToDate[index]) {
            case DependencyState.Unknown:
                return this.fileDependenciesUpToDate(fileName, index, oldState);
            case DependencyState.Ok:
                return true;
            case DependencyState.Outdated:
                return false;
        }
    }

    private fileDependenciesUpToDate(fileName: string, index: number, oldState: StaticProgramState): boolean {
        // File names that are waiting to be processed, each iteration of the loop processes one file
        const fileNameQueue = [fileName];
        // For each entry in `fileNameQueue` this holds the index of that file in `oldState.files`
        const indexQueue = [index];
        // If a file is waiting for its children to be processed, it is moved from `indexQueue` to `parents`
        const parents: number[] = [];
        // For each entry in `parents` this holds the number of children that still need to be processed for that file
        const childCounts = [];
        // For each entry in `parents` this holds the index in of the earliest circular dependency in `parents`.
        // For example, a value of `[Number.MAX_SAFE_INTEGER, 0]` means that `parents[1]` has a dependency on `parents[0]` (the root file).
        const circularDependenciesQueue: number[] = [];
        // If a file has a circular on one of its parents, it is moved from `indexQueue` to the current cycle
        // or creates a new cycle if its parent is not already in a cycle.
        const cycles: Array<Set<number>> = [];
        while (true) {
            index = indexQueue.pop()!;
            fileName = fileNameQueue.pop()!;
            processFile: {
                switch (<DependencyState>this.dependenciesUpToDate[index]) {
                    case DependencyState.Outdated:
                        return markAsOutdated(parents, index, cycles, this.dependenciesUpToDate);
                    case DependencyState.Ok:
                        break processFile;
                }
                for (const cycle of cycles) {
                    if (cycle.has(index)) {
                        // we already know this is a circular dependency, skip this one and simply mark the parent as circular
                        setCircularDependency(
                            parents,
                            circularDependenciesQueue,
                            index,
                            cycles,
                            findCircularDependencyOfCycle(parents, circularDependenciesQueue, cycle),
                        );
                        break processFile;
                    }
                }
                let earliestCircularDependency = Number.MAX_SAFE_INTEGER;
                let childCount = 0;
                const old = oldState.files[index];
                const dependencies = this.resolver.getDependencies(fileName);
                const keys = old.dependencies === undefined ? emptyArray : Object.keys(old.dependencies);

                if (dependencies.size !== keys.length)
                    return markAsOutdated(parents, index, cycles, this.dependenciesUpToDate);
                for (const key of keys) {
                    let newDeps = dependencies.get(key);
                    const oldDeps = old.dependencies![key];
                    if (oldDeps === null) {
                        if (newDeps !== null)
                            return markAsOutdated(parents, index, cycles, this.dependenciesUpToDate);
                        continue;
                    }
                    if (newDeps === null)
                        return markAsOutdated(parents, index, cycles, this.dependenciesUpToDate);
                    newDeps = Array.from(new Set(newDeps));
                    if (newDeps.length !== oldDeps.length)
                        return markAsOutdated(parents, index, cycles, this.dependenciesUpToDate);
                    const newDepsWithId = this.sortById(newDeps);
                    for (let i = 0; i < newDepsWithId.length; ++i) {
                        const oldDepState = oldState.files[oldDeps[i]];
                        if (newDepsWithId[i].id !== oldDepState.id)
                            return markAsOutdated(parents, index, cycles, this.dependenciesUpToDate);
                        if (!this.assumeChangesOnlyAffectDirectDependencies && fileName !== newDepsWithId[i].fileName) {
                            const indexInQueue = parents.indexOf(oldDeps[i]);
                            if (indexInQueue === -1) {
                                // no circular dependency
                                fileNameQueue.push(newDepsWithId[i].fileName);
                                indexQueue.push(oldDeps[i]);
                                ++childCount;
                            } else if (indexInQueue < earliestCircularDependency) {
                                earliestCircularDependency = indexInQueue;
                            }
                        }
                    }
                }

                if (earliestCircularDependency !== Number.MAX_SAFE_INTEGER) {
                    earliestCircularDependency =
                        setCircularDependency(parents, circularDependenciesQueue, index, cycles, earliestCircularDependency);
                } else if (childCount === 0) {
                    this.dependenciesUpToDate[index] = DependencyState.Ok;
                }
                if (childCount !== 0) {
                    parents.push(index);
                    childCounts.push(childCount);
                    circularDependenciesQueue.push(earliestCircularDependency);
                    continue;
                }
            }
            // we only get here for files with no children to process
            if (parents.length === 0)
                return true; // only happens if the initial file has no dependencies or they are all already known as Ok

            while (--childCounts[childCounts.length - 1] === 0) {
                index = parents.pop()!;
                childCounts.pop();
                const earliestCircularDependency = circularDependenciesQueue.pop()!;
                if (earliestCircularDependency >= parents.length) {
                    this.dependenciesUpToDate[index] = DependencyState.Ok;
                    if (earliestCircularDependency !== Number.MAX_SAFE_INTEGER)
                        for (const dep of cycles.pop()!) // cycle ends here
                            // update result for files that had a circular dependency on this one
                            this.dependenciesUpToDate[dep] = DependencyState.Ok;
                }
                if (parents.length === 0)
                    return true;
            }
        }
    }

    public save() {
        if (this.fileResults.size === 0)
            return; // nothing to save
        const oldState = this[oldStateSymbol];
        if (oldState !== undefined && this.dependenciesUpToDate.every((v) => v === DependencyState.Ok)) {
            // state is still good, only update results
            const files = oldState.files.slice();
            for (const [fileName, result] of this.fileResults) {
                const index = this.lookupFileIndex(fileName, oldState)!;
                files[index] = {...files[index], ...result};
            }
            this.statePersistence.saveState(this.project, {
                ...oldState,
                files,
            });
        } else {
            this.statePersistence.saveState(this.project, this.aggregate());
        }
    }

    private aggregate(): StaticProgramState {
        const additionalFiles = new Set<string>();
        const oldState = this.tryReuseOldState();
        const sourceFiles = this.program.getSourceFiles();
        const lookup: Record<string, number> = {};
        const mapToIndex = ({fileName}: {fileName: string}) => {
            const relativeName = this.getRelativePath(fileName);
            let index = lookup[relativeName];
            if (index === undefined) {
                index = sourceFiles.length + additionalFiles.size;
                additionalFiles.add(fileName);
                lookup[relativeName] = index;
            }
            return index;
        };
        const mapDependencies = (dependencies: ReadonlyMap<string, null | readonly string[]>) => {
            if (dependencies.size === 0)
                return;
            const result: Record<string, null | number[]> = {};
            for (const [key, f] of dependencies)
                result[key] = f === null
                    ? null
                    : this.sortById(Array.from(new Set(f))).map(mapToIndex);
            return result;
        };
        const files: StaticProgramState.FileState[] = [];
        for (let i = 0; i < sourceFiles.length; ++i)
            lookup[this.getRelativePath(sourceFiles[i].fileName)] = i;
        for (const file of sourceFiles) {
            let results = this.fileResults.get(file.fileName);
            if (results === undefined && oldState !== undefined) {
                const index = this.lookupFileIndex(file.fileName, oldState);
                if (index !== undefined) {
                    const old = oldState.files[index];
                    if (old.result !== undefined)
                        results = <FileResults>old;
                }
            }
            if (results !== undefined && !this.isFileUpToDate(file.fileName)) {
                log('Discarding outdated results for %s', file.fileName);
                results = undefined;
            }
            files.push({
                ...results,
                id: this.getContentId(file.fileName),
                dependencies: mapDependencies(this.resolver.getDependencies(file.fileName)),
            });
        }
        for (const additional of additionalFiles)
            files.push({id: this.getContentId(additional)});
        return {
            files,
            lookup,
            v: STATE_VERSION,
            ts: ts.version,
            cs: this.caseSensitive,
            global: this.sortById(this.resolver.getFilesAffectingGlobalScope()).map(mapToIndex),
            options: this.optionsHash,
        };
    }

    private sortById(fileNames: readonly string[]) {
        return fileNames
            .map((f) => ({fileName: f, id: this.getContentId(f)}))
            .sort(compareId);
    }

    private lookupFileIndex(fileName: string, oldState: StaticProgramState): number | undefined {
        fileName = this.getRelativePath(fileName);
        if (!oldState.cs && this.caseSensitive)
            fileName = fileName.toLowerCase();
        return oldState.lookup[fileName];
    }

    private remapFileNames(oldState: StaticProgramState): StaticProgramState {
        // only need to remap if oldState is case sensitive and current host is case insensitive
        if (!oldState.cs || this.caseSensitive)
            return oldState;
        const lookup: Record<string, number> = {};
        for (const [key, value] of Object.entries(oldState.lookup))
            lookup[key.toLowerCase()] = value;
        return {...oldState, lookup, cs: false};
    }
}

function findCircularDependencyOfCycle(parents: readonly number[], circularDependencies: readonly number[], cycle: ReadonlySet<number>) {
    for (let i = 0; i < parents.length; ++i) {
        const dep = circularDependencies[i];
        if (dep !== Number.MAX_SAFE_INTEGER && cycle.has(parents[i]))
            return dep;
    }
    /* istanbul ignore next */
    throw new Error('should never happen');
}

function setCircularDependency(
    parents: readonly number[],
    circularDependencies: number[],
    self: number,
    cycles: Array<Set<number>>,
    earliestCircularDependency: number,
) {
    let cyclesToMerge = 0;
    for (let i = circularDependencies.length - 1, inCycle = false; i >= earliestCircularDependency; --i) {
        const dep = circularDependencies[i];
        if (dep === Number.MAX_SAFE_INTEGER) {
            inCycle = false;
        } else {
            if (!inCycle) {
                ++cyclesToMerge;
                inCycle = true;
            }
            if (dep === i) {
                inCycle = false; // if cycle ends here, the next parent might start a new one
            } else if (dep <= earliestCircularDependency) {
                earliestCircularDependency = dep;
                break;
            }
        }
    }
    let targetCycle;
    if (cyclesToMerge === 0) {
        targetCycle = new Set<number>();
        cycles.push(targetCycle);
    } else {
        targetCycle = cycles[cycles.length - cyclesToMerge];
        while (--cyclesToMerge)
            for (const d of cycles.pop()!)
                targetCycle.add(d);
    }
    targetCycle.add(self);
    for (let i = circularDependencies.length - 1; i >= earliestCircularDependency; --i) {
        targetCycle.add(parents[i]);
        circularDependencies[i] = earliestCircularDependency;
    }
    return earliestCircularDependency;
}

function markAsOutdated(parents: readonly number[], index: number, cycles: ReadonlyArray<ReadonlySet<number>>, results: Uint8Array) {
    results[index] = DependencyState.Outdated;
    for (index of parents)
        results[index] = DependencyState.Outdated;
    for (const cycle of cycles)
        for (index of cycle)
            results[index] = DependencyState.Outdated;
    return false;
}

function compareId(a: {id: string}, b: {id: string}) {
    return +(a.id >= b.id) - +(a.id <= b.id);
}

const enum CompilerOptionKind {
    Ignore = 0,
    Value = 1,
    Path = 2,
    PathArray = 3,
}

type KnownCompilerOptions = // tslint:disable-next-line:no-unused
    {[K in keyof ts.CompilerOptions]: string extends K ? never : K} extends {[K in keyof ts.CompilerOptions]: infer P} ? P : never;

type AdditionalCompilerOptions = 'pathsBasePath';

const compilerOptionKinds: Record<KnownCompilerOptions | AdditionalCompilerOptions, CompilerOptionKind> = {
    allowJs: CompilerOptionKind.Value,
    allowSyntheticDefaultImports: CompilerOptionKind.Value,
    allowUmdGlobalAccess: CompilerOptionKind.Value,
    allowUnreachableCode: CompilerOptionKind.Value,
    allowUnusedLabels: CompilerOptionKind.Value,
    alwaysStrict: CompilerOptionKind.Value,
    assumeChangesOnlyAffectDirectDependencies: CompilerOptionKind.Value,
    baseUrl: CompilerOptionKind.Path,
    charset: CompilerOptionKind.Value,
    checkJs: CompilerOptionKind.Value,
    composite: CompilerOptionKind.Value,
    declaration: CompilerOptionKind.Value,
    declarationDir: CompilerOptionKind.Path,
    declarationMap: CompilerOptionKind.Value,
    disableReferencedProjectLoad: CompilerOptionKind.Ignore,
    disableSizeLimit: CompilerOptionKind.Value,
    disableSourceOfProjectReferenceRedirect: CompilerOptionKind.Value,
    disableSolutionSearching: CompilerOptionKind.Ignore,
    downlevelIteration: CompilerOptionKind.Value,
    emitBOM: CompilerOptionKind.Value,
    emitDeclarationOnly: CompilerOptionKind.Value,
    emitDecoratorMetadata: CompilerOptionKind.Value,
    esModuleInterop: CompilerOptionKind.Value,
    experimentalDecorators: CompilerOptionKind.Value,
    forceConsistentCasingInFileNames: CompilerOptionKind.Value,
    importHelpers: CompilerOptionKind.Value,
    importsNotUsedAsValues: CompilerOptionKind.Value,
    incremental: CompilerOptionKind.Value,
    inlineSourceMap: CompilerOptionKind.Value,
    inlineSources: CompilerOptionKind.Value,
    isolatedModules: CompilerOptionKind.Value,
    jsx: CompilerOptionKind.Value,
    jsxFactory: CompilerOptionKind.Value,
    jsxFragmentFactory: CompilerOptionKind.Value,
    jsxImportSource: CompilerOptionKind.Value,
    keyofStringsOnly: CompilerOptionKind.Value,
    lib: CompilerOptionKind.Value,
    locale: CompilerOptionKind.Value,
    mapRoot: CompilerOptionKind.Value,
    maxNodeModuleJsDepth: CompilerOptionKind.Value,
    module: CompilerOptionKind.Value,
    moduleResolution: CompilerOptionKind.Value,
    newLine: CompilerOptionKind.Value,
    noEmit: CompilerOptionKind.Value,
    noEmitHelpers: CompilerOptionKind.Value,
    noEmitOnError: CompilerOptionKind.Value,
    noErrorTruncation: CompilerOptionKind.Value,
    noFallthroughCasesInSwitch: CompilerOptionKind.Value,
    noImplicitAny: CompilerOptionKind.Value,
    noImplicitReturns: CompilerOptionKind.Value,
    noImplicitThis: CompilerOptionKind.Value,
    noImplicitUseStrict: CompilerOptionKind.Value,
    noLib: CompilerOptionKind.Value,
    noPropertyAccessFromIndexSignature: CompilerOptionKind.Value,
    noResolve: CompilerOptionKind.Value,
    noStrictGenericChecks: CompilerOptionKind.Value,
    noUncheckedIndexedAccess: CompilerOptionKind.Value,
    noUnusedLocals: CompilerOptionKind.Value,
    noUnusedParameters: CompilerOptionKind.Value,
    out: CompilerOptionKind.Value,
    outDir: CompilerOptionKind.Path,
    outFile: CompilerOptionKind.Path,
    paths: CompilerOptionKind.Value,
    pathsBasePath: CompilerOptionKind.Path,
    preserveConstEnums: CompilerOptionKind.Value,
    preserveSymlinks: CompilerOptionKind.Value,
    project: CompilerOptionKind.Ignore,
    reactNamespace: CompilerOptionKind.Value,
    removeComments: CompilerOptionKind.Value,
    resolveJsonModule: CompilerOptionKind.Value,
    rootDir: CompilerOptionKind.Path,
    rootDirs: CompilerOptionKind.PathArray,
    skipDefaultLibCheck: CompilerOptionKind.Value,
    skipLibCheck: CompilerOptionKind.Value,
    sourceMap: CompilerOptionKind.Value,
    sourceRoot: CompilerOptionKind.Value,
    strict: CompilerOptionKind.Value,
    strictBindCallApply: CompilerOptionKind.Value,
    strictFunctionTypes: CompilerOptionKind.Value,
    strictNullChecks: CompilerOptionKind.Value,
    strictPropertyInitialization: CompilerOptionKind.Value,
    stripInternal: CompilerOptionKind.Value,
    suppressExcessPropertyErrors: CompilerOptionKind.Value,
    suppressImplicitAnyIndexErrors: CompilerOptionKind.Value,
    target: CompilerOptionKind.Value,
    traceResolution: CompilerOptionKind.Value,
    tsBuildInfoFile: CompilerOptionKind.Ignore,
    typeRoots: CompilerOptionKind.PathArray,
    types: CompilerOptionKind.Value,
    useDefineForClassFields: CompilerOptionKind.Value,
};

function computeCompilerOptionsHash(options: ts.CompilerOptions, relativeTo: string) {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(options).sort()) {
        switch (compilerOptionKinds[<KnownCompilerOptions>key]) {
            case CompilerOptionKind.Value:
                obj[key] = options[key];
                break;
            case CompilerOptionKind.Path:
                obj[key] = makeRelativePath(<string>options[key]);
                break;
            case CompilerOptionKind.PathArray:
                obj[key] = (<string[]>options[key]).map(makeRelativePath);
        }
    }
    return '' + djb2(JSON.stringify(obj));

    function makeRelativePath(p: string) {
        return unixifyPath(path.relative(relativeTo, p));
    }
}
