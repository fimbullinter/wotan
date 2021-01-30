import * as ts from 'typescript';
import { DependencyResolver, DependencyResolverFactory, DependencyResolverHost } from './dependency-resolver';
import { EffectiveConfiguration, Finding, ReducedConfiguration, StatePersistence } from '@fimbul/ymir';
export interface ProgramState {
    update(program: ts.Program, updatedFile: string): void;
    getUpToDateResult(fileName: string, config: EffectiveConfiguration): readonly Finding[] | undefined;
    setFileResult(fileName: string, config: EffectiveConfiguration, result: readonly Finding[]): void;
    save(): void;
}
export declare class ProgramStateFactory {
    constructor(resolverFactory: DependencyResolverFactory, statePersistence: StatePersistence);
    create(program: ts.Program, host: ProgramStateHost & DependencyResolverHost, tsconfigPath: string): ProgramStateImpl;
}
export declare type ProgramStateHost = Pick<ts.CompilerHost, 'getCanonicalFileName' | 'useCaseSensitiveFileNames'>;
declare const oldStateSymbol: unique symbol;
declare class ProgramStateImpl implements ProgramState {
    constructor(host: ProgramStateHost, program: ts.Program, resolver: DependencyResolver, statePersistence: StatePersistence, project: string);
    update(program: ts.Program, updatedFile: string): void;
    getUpToDateResult(fileName: string, config: ReducedConfiguration): readonly Finding[] | undefined;
    setFileResult(fileName: string, config: ReducedConfiguration, result: ReadonlyArray<Finding>): void;
    save(): void;
}
export {};
