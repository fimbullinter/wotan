import * as ts from 'typescript';
import { Finding, EffectiveConfiguration, LintAndFixFileResult, Severity, MessageHandler, AbstractProcessor, DeprecationHandler, FindingFilterFactory } from '@fimbul/ymir';
import { RuleLoader } from './services/rule-loader';
export interface UpdateFileResult {
    file: ts.SourceFile;
    program?: ts.Program;
}
export interface LinterOptions {
    reportUselessDirectives?: Severity;
}
export declare type UpdateFileCallback = (content: string, range: ts.TextChangeRange) => UpdateFileResult | undefined;
export declare class Linter {
    private ruleLoader;
    private logger;
    private deprecationHandler;
    private filterFactory;
    constructor(ruleLoader: RuleLoader, logger: MessageHandler, deprecationHandler: DeprecationHandler, filterFactory: FindingFilterFactory);
    lintFile(file: ts.SourceFile, config: EffectiveConfiguration, program?: ts.Program, options?: LinterOptions): ReadonlyArray<Finding>;
    lintAndFix(file: ts.SourceFile, content: string, config: EffectiveConfiguration, updateFile: UpdateFileCallback, iterations?: number, program?: ts.Program, processor?: AbstractProcessor, options?: LinterOptions): LintAndFixFileResult;
    private prepareRules;
    private applyRules;
}
