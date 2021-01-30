import * as ts from 'typescript';
export interface DependencyResolver {
    update(program: ts.Program, updatedFile: string): void;
    getDependencies(fileName: string): ReadonlyMap<string, null | readonly string[]>;
    getFilesAffectingGlobalScope(): readonly string[];
}
export declare type DependencyResolverHost = Required<Pick<ts.CompilerHost, 'resolveModuleNames'>> & {
    useSourceOfProjectReferenceRedirect?(): boolean;
};
export declare class DependencyResolverFactory {
    create(host: DependencyResolverHost, program: ts.Program): DependencyResolver;
}
