import * as ts from 'typescript';
import { ProjectHost } from '../project-host';
export interface DependencyResolver {
    update(program: ts.Program, updatedFile: string): void;
    getDependencies(fileName: string): ReadonlyMap<string, null | readonly string[]>;
    getFilesAffectingGlobalScope(): readonly string[];
}
export declare class DependencyResolverFactory {
    create(host: ProjectHost, program: ts.Program): DependencyResolver;
}
