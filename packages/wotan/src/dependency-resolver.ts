import { injectable } from 'inversify';
import * as ts from 'typescript';
import { isModuleDeclaration, isNamespaceExportDeclaration, findImports, ImportKind } from 'tsutils';
import { resolveCachedResult, getOutputFileNamesOfProjectReference, iterateProjectReferences } from './utils';
import bind from 'bind-decorator';

export interface DependencyResolver {
    update(program: DependencyResolverProgram, updatedFiles: Iterable<string>): void;
    getDependencies(fileName: string): ReadonlyArray<string>;
    getFilesAffectingGlobalScope(): ReadonlyArray<string>;
}

export type DependencyResolverProgram =
    Pick<ts.Program, 'getCompilerOptions' | 'getSourceFiles' | 'getSourceFile' | 'getCurrentDirectory' | 'getResolvedProjectReferences'>;

@injectable()
export class DependencyResolverFactory {
    public create(host: ts.CompilerHost, program: DependencyResolverProgram): DependencyResolver {
        return new DependencyResolverImpl(host, program);
    }
}

class DependencyResolverImpl implements DependencyResolver {
    private affectsGlobalScope!: ReadonlyArray<string>;
    private ambientModules!: ReadonlyMap<string, string[]>;
    private moduleAugmentations!: ReadonlyMap<string, string[]>;
    private patternAmbientModules!: ReadonlyMap<string, string[]>;
    private ambientModuleAugmentations!: ReadonlyMap<string, string[]>;
    private patternModuleAugmentations!: ReadonlyMap<string, string[]>;
    private moduleDependenciesPerFile!: ReadonlyMap<string, string[][]>;
    private dependencies = new Map<string, Set<string>>();
    private fileToProjectReference: ReadonlyMap<string, ts.ResolvedProjectReference> | undefined = undefined;

    private cache = ts.createModuleResolutionCache(this.program.getCurrentDirectory(), (f) => this.host.getCanonicalFileName(f));
    constructor(private host: ts.CompilerHost, private program: DependencyResolverProgram) {
        this.collectMetaData();
    }

    public update(program: DependencyResolverProgram, updatedFiles: Iterable<string>) {
        for (const file of updatedFiles)
            this.dependencies.delete(file);
        this.program = program;
        this.collectMetaData();
    }

    private collectMetaData() {
        const affectsGlobalScope = new Set<string>();
        const ambientModules = new Map<string, string[]>();
        const patternAmbientModules = new Map<string, string[]>();
        const moduleAugmentationsTemp = new Map<string, string[]>();
        const moduleDepencenciesPerFile = new Map<string, string[][]>();
        for (const file of this.program.getSourceFiles()) {
            const meta = collectFileMetadata(file);
            if (meta.affectsGlobalScope)
                affectsGlobalScope.add(file.fileName);
            for (const ambientModule of meta.ambientModules) {
                const map = meta.isExternalModule
                    ? moduleAugmentationsTemp
                    : ambientModule.includes('*')
                        ? patternAmbientModules
                        : ambientModules;
                addToListWithReverse(map, ambientModule, file.fileName, meta.isExternalModule ? undefined : moduleDepencenciesPerFile);
                const existing = map.get(ambientModule);
                if (existing === undefined) {
                    map.set(ambientModule, [file.fileName]);
                } else {
                    existing.push(file.fileName);
                }
            }
        }

        const ambientModuleAugmentations = new Map<string, string[]>();
        const moduleAugmentations = new Map<string, string[]>();
        const patternModuleAugmentations = new Map<string, string[]>();
        for (const [module, files] of moduleAugmentationsTemp) {
            if (ambientModules.has(module)) {
                ambientModuleAugmentations.set(module, files);
                continue;
            }
            for (const file of files) {
                const {resolvedModule} = ts.resolveModuleName(module, file, this.program.getCompilerOptions(), this.host, this.cache);
                if (resolvedModule !== undefined) {
                    addToListWithReverse(moduleAugmentations, resolvedModule.resolvedFileName, file, moduleDepencenciesPerFile);
                } else {
                    const matchingPattern = getBestMatchingPattern(module, patternAmbientModules.keys());
                    if (matchingPattern !== undefined)
                        addToListWithReverse(patternModuleAugmentations, matchingPattern, file, moduleDepencenciesPerFile);
                }
            }
        }

        this.ambientModules = ambientModules;
        this.patternAmbientModules = patternAmbientModules;
        this.ambientModuleAugmentations = ambientModuleAugmentations;
        this.moduleAugmentations = moduleAugmentations;
        this.patternModuleAugmentations = patternModuleAugmentations;
        this.moduleDependenciesPerFile = moduleDepencenciesPerFile;
        this.affectsGlobalScope = Array.from(affectsGlobalScope).sort();
    }

    public getDependencies(file: string) {
        const result = new Set<string>();
        const dependenciesFromModuleDeclarations = this.moduleDependenciesPerFile.get(file);
        if (dependenciesFromModuleDeclarations)
            for (const deps of dependenciesFromModuleDeclarations)
                addAllExceptSelf(result, deps, file);
        addAllExceptSelf(result, resolveCachedResult(this.dependencies, file, this.resolveDependencies), file);
        return Array.from(result).sort();
    }

    @bind
    private resolveDependencies(fileName: string) {
        const result = new Set<string>();
        const sourceFile = this.program.getSourceFile(fileName)!;
        let redirect: ts.ResolvedProjectReference | undefined;
        let options: ts.CompilerOptions | undefined;
        for (const {text: moduleName} of findImports(sourceFile, ImportKind.All)) {
            const filesAffectingAmbientModule = this.ambientModules.get(moduleName);
            if (filesAffectingAmbientModule !== undefined) {
                addAllExceptSelf(result, filesAffectingAmbientModule, moduleName);
                addAllExceptSelf(result, this.ambientModuleAugmentations.get(moduleName), fileName);
                continue;
            }

            if (options === undefined) {
                if (this.fileToProjectReference === undefined)
                    this.fileToProjectReference = createProjectReferenceMap(this.program.getResolvedProjectReferences());
                redirect = this.fileToProjectReference.get(fileName);
                options = redirect === undefined ? this.program.getCompilerOptions() : redirect.commandLine.options;
            }

            const {resolvedModule} = ts.resolveModuleName(moduleName, fileName, options, this.host, this.cache, redirect);
            if (resolvedModule !== undefined) {
                if (resolvedModule.resolvedFileName !== fileName)
                    result.add(resolvedModule.resolvedFileName);
                addAllExceptSelf(result, this.moduleAugmentations.get(resolvedModule.resolvedFileName), fileName);
            } else {
                const pattern = getBestMatchingPattern(moduleName, this.patternAmbientModules.keys());
                if (pattern !== undefined) {
                    addAllExceptSelf(result, this.patternAmbientModules.get(pattern), fileName);
                    addAllExceptSelf(result, this.patternModuleAugmentations.get(pattern), fileName);
                }
            }
        }

        return result;
    }

    public getFilesAffectingGlobalScope() {
        return this.affectsGlobalScope;
    }
}

function getBestMatchingPattern(moduleName: string, patternAmbientModules: Iterable<string>) {
    // TypeScript uses the pattern with the longest matching prefix
    let longestMatchLength = -1;
    let longestMatch: string | undefined;
    for (const pattern of patternAmbientModules) {
        if (moduleName.length < pattern.length - 1)
            continue; // compare length without the wildcard first, to avoid false positives like 'foo' matching 'foo*oo'
        const index = pattern.indexOf('*');
        if (
            index > longestMatchLength &&
            moduleName.startsWith(pattern.substring(0, index)) &&
            moduleName.endsWith(pattern.substring(index + 1))
        ) {
            longestMatchLength = index;
            longestMatch = pattern;
        }
    }
    return longestMatch;
}

function addAllExceptSelf(receiver: Set<string>, list: Iterable<string> | undefined, current: string) {
    if (list)
        for (const file of list)
            if (file !== current)
                receiver.add(file);
}

function createProjectReferenceMap(references: ts.ResolvedProjectReference['references']) {
    const result = new Map<string, ts.ResolvedProjectReference>();
    for (const ref of iterateProjectReferences(references))
        for (const file of getOutputFileNamesOfProjectReference(ref))
            result.set(file, ref);
    return result;
}

function addToListWithReverse(map: Map<string, string[]>, key: string, value: string, reverse?: Map<string, string[][]>) {
    const list = addToList(map, key, value);
    if (reverse !== undefined)
        addToList(reverse, value, list);
}

function addToList<T>(map: Map<string, T[]>, key: string, value: T) {
    let arr = map.get(key);
    if (arr === undefined) {
        map.set(key, arr = [value]);
    } else {
        arr.push(value);
    }
    return arr;
}

interface MetaData {
    affectsGlobalScope: boolean;
    ambientModules: Set<string>;
    isExternalModule: boolean;
}

function collectFileMetadata(sourceFile: ts.SourceFile): MetaData {
    let affectsGlobalScope: boolean | undefined;
    const ambientModules = new Set<string>();
    const isExternalModule = ts.isExternalModule(sourceFile);
    for (const statement of sourceFile.statements) {
        if (statement.flags & ts.NodeFlags.GlobalAugmentation) {
            affectsGlobalScope = true;
        } else if (isModuleDeclaration(statement) && statement.name.kind === ts.SyntaxKind.StringLiteral) {
            ambientModules.add(statement.name.text);
        } else if (isNamespaceExportDeclaration(statement)) {
            affectsGlobalScope = true; // TODO that's only correct with allowUmdGlobalAccess compilerOption
        } else if (affectsGlobalScope === undefined) { // files that only consist of ambient modules do not affect global scope
            affectsGlobalScope = !isExternalModule;
        }
    }
    return {ambientModules, isExternalModule, affectsGlobalScope: affectsGlobalScope === true};
}
