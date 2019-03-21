import * as ts from 'typescript';
import { Finding, EffectiveConfiguration, LintAndFixFileResult, Severity, MessageHandler, AbstractProcessor, DeprecationHandler, FindingFilterFactory } from '@fimbul/ymir';
import { RuleLoader } from './services/rule-loader';
export interface LinterOptions {
    reportUselessDirectives?: Severity;
}
export interface ProgramFactory {
    getCompilerOptions(): ts.CompilerOptions;
    getProgram(): ts.Program;
}
export declare type UpdateFileCallback = (content: string, range: ts.TextChangeRange) => ts.SourceFile | undefined;
export declare class Linter {
    constructor(ruleLoader: RuleLoader, logger: MessageHandler, deprecationHandler: DeprecationHandler, filterFactory: FindingFilterFactory);
    lintFile(file: ts.SourceFile, config: EffectiveConfiguration, programOrFactory?: ProgramFactory | ts.Program, options?: LinterOptions): ReadonlyArray<Finding>;
    lintAndFix(file: ts.SourceFile, content: string, config: EffectiveConfiguration, updateFile: UpdateFileCallback, iterations?: number, programFactory?: ProgramFactory, processor?: AbstractProcessor, options?: LinterOptions): LintAndFixFileResult;
}
