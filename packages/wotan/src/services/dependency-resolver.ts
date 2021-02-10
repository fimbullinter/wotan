import { injectable } from 'inversify';
import * as ts from 'typescript';
import { isModuleDeclaration, isNamespaceExportDeclaration, findImports, ImportKind } from 'tsutils';
import { resolveCachedResult, getOutputFileNamesOfProjectReference, iterateProjectReferences, unixifyPath } from '../utils';
import bind from 'bind-decorator';
import * as path from 'path';

export interface DependencyResolver {
    update(program: ts.Program, updatedFile: string): void;
    getDependencies(fileName: string): ReadonlyMap<string, null | readonly string[]>;
    getFilesAffectingGlobalScope(): readonly string[];
}

export type DependencyResolverHost = Required<Pick<ts.CompilerHost, 'resolveModuleNames'>> & {
    useSourceOfProjectReferenceRedirect?(): boolean;
};

@injectable()
export class DependencyResolverFactory {
    public create(host: DependencyResolverHost, program: ts.Program): DependencyResolver {
        return new DependencyResolverImpl(host, program);
    }
}

interface DependencyResolverState {
    affectsGlobalScope: readonly string[];
    ambientModules: ReadonlyMap<string, readonly string[]>;
    moduleAugmentations: ReadonlyMap<string, readonly string[]>;
    patternAmbientModules: ReadonlyMap<string, readonly string[]>;
}

class DependencyResolverImpl implements DependencyResolver {
    private dependencies = new Map<string, Map<string, string | null>>();
    private fileToProjectReference: ReadonlyMap<string, ts.ResolvedProjectReference> | undefined = undefined;
    private fileMetadata = new Map<string, MetaData>();
    private compilerOptions = this.program.getCompilerOptions();
    private useSourceOfProjectReferenceRedirect = this.host.useSourceOfProjectReferenceRedirect?.() === true &&
        !this.compilerOptions.disableSourceOfProjectReferenceRedirect;

    private state: DependencyResolverState | undefined = undefined;

    constructor(private host: DependencyResolverHost, private program: ts.Program) {}

    public update(program: ts.Program, updatedFile: string) {
        this.state = undefined;
        this.dependencies.delete(updatedFile);
        this.fileMetadata.delete(updatedFile);
        this.program = program;
    }

    private buildState(): DependencyResolverState {
        const affectsGlobalScope = [];
        const ambientModules = new Map<string, string[]>();
        const patternAmbientModules = new Map<string, string[]>();
        const moduleAugmentationsTemp = new Map<string, string[]>();
        for (const file of this.program.getSourceFiles()) {
            const meta = this.getFileMetaData(file.fileName);
            if (meta.affectsGlobalScope)
                affectsGlobalScope.push(file.fileName);
            for (const ambientModule of meta.ambientModules) {
                const map = meta.isExternalModule
                    ? moduleAugmentationsTemp
                    : ambientModule.includes('*')
                        ? patternAmbientModules
                        : ambientModules;
                addToList(map, ambientModule, file.fileName);
            }
        }

        const moduleAugmentations = new Map<string, string[]>();
        for (const [module, files] of moduleAugmentationsTemp) {
            // if an ambient module with the same identifier exists, the augmentation always applies to that
            const ambientModuleAffectingFiles = ambientModules.get(module);
            if (ambientModuleAffectingFiles !== undefined) {
                ambientModuleAffectingFiles.push(...files);
                continue;
            }
            for (const file of files) {
                const resolved = this.getExternalReferences(file).get(module);
                // if an augmentation's identifier can be resolved from the declaring file, the augmentation applies to the resolved path
                if (resolved != null) { // tslint:disable-line:triple-equals
                    addToList(moduleAugmentations, resolved, file);
                } else {
                    // if a pattern ambient module matches the augmented identifier, the augmentation applies to that
                    const matchingPattern = getBestMatchingPattern(module, patternAmbientModules.keys());
                    if (matchingPattern !== undefined)
                        addToList(patternAmbientModules, matchingPattern, file);
                }
            }
        }

        return {
            affectsGlobalScope,
            ambientModules,
            moduleAugmentations,
            patternAmbientModules,
        };
    }

    public getFilesAffectingGlobalScope() {
        return (this.state ??= this.buildState()).affectsGlobalScope;
    }

    public getDependencies(file: string) {
        this.state ??= this.buildState();
        const result = new Map<string, null | readonly string[]>();
        {
            const augmentations = this.state.moduleAugmentations.get(file);
            if (augmentations !== undefined)
                result.set('\0', augmentations);
        }
        for (const [identifier, resolved] of this.getExternalReferences(file)) {
            const filesAffectingAmbientModule = this.state.ambientModules.get(identifier);
            if (filesAffectingAmbientModule !== undefined) {
                result.set(identifier, filesAffectingAmbientModule);
            } else if (resolved !== null) {
                const list = [resolved];
                const augmentations = this.state.moduleAugmentations.get(resolved);
                if (augmentations !== undefined)
                    list.push(...augmentations);
                result.set(identifier, list);
            } else {
                const pattern = getBestMatchingPattern(identifier, this.state.patternAmbientModules.keys());
                if (pattern !== undefined) {
                    result.set(identifier, this.state.patternAmbientModules.get(pattern)!);
                } else {
                    result.set(identifier, null);
                }
            }
        }
        const meta = this.fileMetadata.get(file)!;
        if (!meta.isExternalModule)
            for (const ambientModule of meta.ambientModules)
                result.set(
                    ambientModule,
                    this.state[ambientModule.includes('*') ? 'patternAmbientModules' : 'ambientModules'].get(ambientModule)!,
                );

        return result;
    }

    private getFileMetaData(fileName: string) {
        return resolveCachedResult(this.fileMetadata, fileName, this.collectMetaDataForFile);
    }

    private getExternalReferences(fileName: string) {
        return resolveCachedResult(this.dependencies, fileName, this.collectExternalReferences);
    }

    @bind
    private collectMetaDataForFile(fileName: string) {
        return collectFileMetadata(this.program.getSourceFile(fileName)!);
    }

    @bind
    private collectExternalReferences(fileName: string): Map<string, string | null> {
        // TODO add tslib if importHelpers is enabled
        const sourceFile = this.program.getSourceFile(fileName)!;
        const references = new Set(findImports(sourceFile, ImportKind.All, false).map(({text}) => text));
        if (ts.isExternalModule(sourceFile))
            for (const augmentation of this.getFileMetaData(fileName).ambientModules)
                references.add(augmentation);
        const result = new Map<string, string | null>();
        if (references.size === 0)
            return result;
        this.fileToProjectReference ??= createProjectReferenceMap(this.program.getResolvedProjectReferences());
        const arr = Array.from(references);
        const resolved =
            this.host.resolveModuleNames(arr, fileName, undefined, this.fileToProjectReference.get(fileName), this.compilerOptions);
        for (let i = 0; i < resolved.length; ++i) {
            const current = resolved[i];
            if (current === undefined) {
                result.set(arr[i], null);
            } else {
                const projectReference = this.useSourceOfProjectReferenceRedirect
                    ? this.fileToProjectReference.get(current.resolvedFileName)
                    : undefined;
                if (projectReference === undefined) {
                    result.set(arr[i], current.resolvedFileName);
                } else if (projectReference.commandLine.options.outFile) {
                    // with outFile the files must be global anyway, so we don't care about the exact file
                    result.set(arr[i], projectReference.commandLine.fileNames[0]);
                } else {
                    result.set(arr[i], getSourceOfProjectReferenceRedirect(current.resolvedFileName, projectReference));
                }
            }
        }
        return result;
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

function createProjectReferenceMap(references: ts.ResolvedProjectReference['references']) {
    const result = new Map<string, ts.ResolvedProjectReference>();
    for (const ref of iterateProjectReferences(references))
        for (const file of getOutputFileNamesOfProjectReference(ref))
            result.set(file, ref);
    return result;
}

function addToList<T>(map: Map<string, T[]>, key: string, value: T) {
    const arr = map.get(key);
    if (arr === undefined) {
        map.set(key, [value]);
    } else {
        arr.push(value);
    }
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
            if (!isExternalModule && !affectsGlobalScope && statement.body !== undefined) {
                // search for global augmentations in ambient module blocks
                for (const s of (<ts.ModuleBlock>statement.body).statements) {
                    if (s.flags & ts.NodeFlags.GlobalAugmentation) {
                        affectsGlobalScope = true;
                        break;
                    }
                }
            }

        } else if (isNamespaceExportDeclaration(statement)) {
            affectsGlobalScope = true;
        } else if (affectsGlobalScope === undefined) { // files that only consist of ambient modules do not affect global scope
            affectsGlobalScope = !isExternalModule;
        }
    }
    return {ambientModules, isExternalModule, affectsGlobalScope: affectsGlobalScope === true};
}

function getSourceOfProjectReferenceRedirect(outputFileName: string, ref: ts.ResolvedProjectReference): string {
    const options = ref.commandLine.options;
    const projectDirectory = path.dirname(ref.sourceFile.fileName);
    const origin = unixifyPath(path.resolve(
        options.rootDir || projectDirectory,
        path.relative(options.declarationDir || options.outDir || /* istanbul ignore next */ projectDirectory, outputFileName.slice(0, -5)),
    ));

    for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
        const name = origin + extension;
        if (ref.commandLine.fileNames.includes(name))
            return name;
    }
    /* istanbul ignore next */
    return outputFileName; // should never happen
}
