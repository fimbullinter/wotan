import * as ts from 'typescript';
import { Finding, EffectiveConfiguration, LintAndFixFileResult, Severity, MessageHandler, AbstractProcessor, DeprecationHandler, FindingFilterFactory } from '@fimbul/ymir';
import { RuleLoader } from './services/rule-loader';
export interface LinterOptions {
    reportUselessDirectives?: Severity;
}
/** This factory is used to lazily create or update the Program only when necessary. */
export interface ProgramFactory {
    /** Get the CompilerOptions used to create the Program. */
    getCompilerOptions(): ts.CompilerOptions;
    /** This method is called to retrieve the Program on the first use. It should create or update the Program if necessary. */
    getProgram(): ts.Program;
}
/**
 * Creates a new SourceFile from the updated source.
 *
 * @returns the new `SourceFile` on success or `undefined` to roll back the latest set of changes.
 */
export declare type UpdateFileCallback = (content: string, range: ts.TextChangeRange) => ts.SourceFile | undefined;
export declare class Linter {
    constructor(ruleLoader: RuleLoader, logger: MessageHandler, deprecationHandler: DeprecationHandler, filterFactory: FindingFilterFactory);
    lintFile(file: ts.SourceFile, config: EffectiveConfiguration, programOrFactory?: ProgramFactory | ts.Program, options?: LinterOptions): ReadonlyArray<Finding>;
    lintAndFix(file: ts.SourceFile, content: string, config: EffectiveConfiguration, updateFile: UpdateFileCallback, iterations?: number, programFactory?: ProgramFactory, processor?: AbstractProcessor, options?: LinterOptions, 
    /** Initial set of findings from a cache. If provided, the initial linting is skipped and these findings are used for fixing. */
    findings?: readonly Finding[]): LintAndFixFileResult;
}
