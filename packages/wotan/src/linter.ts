import * as ts from 'typescript';
import {
    Finding,
    EffectiveConfiguration,
    LintAndFixFileResult,
    Replacement,
    RuleContext,
    Severity,
    RuleConstructor,
    MessageHandler,
    AbstractProcessor,
    DeprecationHandler,
    DeprecationTarget,
    FindingFilterFactory,
    FindingFilter,
} from '@fimbul/ymir';
import { applyFixes } from './fix';
import * as debug from 'debug';
import { injectable } from 'inversify';
import { RuleLoader } from './services/rule-loader';
import { calculateChangeRange, invertChangeRange } from './utils';
import { ConvertedAst, convertAst, isCompilerOptionEnabled, getCheckJsDirective } from 'tsutils';

const log = debug('wotan:linter');

export interface UpdateFileResult {
    file: ts.SourceFile;
    program?: ts.Program;
}

export interface LinterOptions {
    reportUselessDirectives?: Severity;
}

/**
 * Creates a new SourceFile from the updated source.
 *
 * @returns the new `SourceFile` on success or `undefined` to roll back the latest set of changes.
 */
export type UpdateFileCallback = (content: string, range: ts.TextChangeRange) => ts.SourceFile | undefined;

@injectable()
export class Linter {
    constructor(
        private ruleLoader: RuleLoader,
        private logger: MessageHandler,
        private deprecationHandler: DeprecationHandler,
        private filterFactory: FindingFilterFactory,
    ) {}

    public lintFile(
        file: ts.SourceFile,
        config: EffectiveConfiguration,
        getProgram?: () => ts.Program,
        options: LinterOptions = {},
    ): ReadonlyArray<Finding> {
        return this.getFindings(file, config, getProgram, undefined, options);
    }

    public lintAndFix(
        file: ts.SourceFile,
        content: string,
        config: EffectiveConfiguration,
        updateFile: UpdateFileCallback,
        iterations: number = 10,
        getProgram?: () => ts.Program,
        processor?: AbstractProcessor,
        options: LinterOptions = {},
    ): LintAndFixFileResult {
        let totalFixes = 0;
        let findings = this.getFindings(file, config, getProgram, processor, options);
        for (let i = 0; i < iterations; ++i) {
            if (findings.length === 0)
                break;
            const fixes = findings.map((f) => f.fix).filter(<T>(f: T | undefined): f is T => f !== undefined);
            if (fixes.length === 0) {
                log('No fixes');
                break;
            }
            log('Trying to apply %d fixes in %d. iteration', fixes.length, i + 1);
            const fixed = applyFixes(content, fixes);
            log('Applied %d fixes', fixed.fixed);
            let newSource: string;
            let fixedRange: ts.TextChangeRange;
            if (processor !== undefined) {
                const {transformed, changeRange} = processor.updateSource(fixed.result, fixed.range);
                fixedRange = changeRange !== undefined ? changeRange : calculateChangeRange(file.text, transformed);
                newSource = transformed;
            } else {
                newSource = fixed.result;
                fixedRange = fixed.range;
            }
            const updateResult = updateFile(newSource, fixedRange);
            if (updateResult === undefined) {
                log('Rolling back latest fixes and abort linting');
                if (processor !== undefined) // reset processor state
                    processor.updateSource(content, invertChangeRange(fixed.range));
                break;
            }
            file = updateResult;
            content = fixed.result;
            totalFixes += fixed.fixed;
            findings = this.getFindings(file, config, getProgram, processor, options);
        }
        return {
            content,
            findings,
            fixes: totalFixes,
        };
    }

    // @internal
    public getFindings(
        sourceFile: ts.SourceFile,
        config: EffectiveConfiguration,
        getProgram: (() => ts.Program) | undefined,
        processor: AbstractProcessor | undefined,
        options: LinterOptions,
    ) {
        let suppressMissingTypeInfoWarning = false;
        log('Linting file %s', sourceFile.fileName);
        if (getProgram !== undefined && /\.jsx?/.test(sourceFile.fileName)) {
            const directive = getCheckJsDirective(sourceFile.text);
            // TODO maybe defer creating the program by creating a proxy getProgram callback
            // TODO better pass compilerOptions as a separate parameter to this function
            if (directive === undefined ? !isCompilerOptionEnabled(getProgram().getCompilerOptions(), 'checkJs') : !directive.enabled) {
                log('Not using type information for this unchecked JS file');
                getProgram = undefined;
                suppressMissingTypeInfoWarning = true;
            }
        }
        const rules = this.prepareRules(config, sourceFile, getProgram, suppressMissingTypeInfoWarning);
        let findings;
        if (rules.length === 0) {
            log('No active rules');
            if (options.reportUselessDirectives !== undefined) {
                findings = this.filterFactory
                    .create({sourceFile, getWrappedAst() { return convertAst(sourceFile).wrapped; }, ruleNames: []})
                    .reportUseless(options.reportUselessDirectives);
                log('Found %d useless directives', findings.length);
            } else {
                findings = [];
            }
        }
        findings = this.applyRules(sourceFile, getProgram, rules, config.settings, options);
        return processor === undefined ? findings : processor.postprocess(findings);
    }

    private prepareRules(
        config: EffectiveConfiguration,
        sourceFile: ts.SourceFile,
        getProgram: (() => ts.Program) | undefined,
        noWarn: boolean,
    ) {
        const rules: PreparedRule[] = [];
        for (const [ruleName, {options, severity, rulesDirectories, rule}] of config.rules) {
            if (severity === 'off')
                continue;
            const ctor = this.ruleLoader.loadRule(rule, rulesDirectories);
            if (ctor === undefined)
                continue;
            if (ctor.deprecated)
                this.deprecationHandler.handle(
                    DeprecationTarget.Rule,
                    ruleName,
                    typeof ctor.deprecated === 'string' ? ctor.deprecated : undefined,
                );
            if (getProgram === undefined && ctor.requiresTypeInformation) {
                if (noWarn) {
                    log('Rule %s requires type information', ruleName);
                } else {
                    this.logger.warn(`Rule '${ruleName}' requires type information.`);
                }
                continue;
            }
            if (ctor.supports !== undefined) {
                const supports = ctor.supports(
                    sourceFile,
                    {get program() { return getProgram && getProgram(); }, options, settings: config.settings},
                );
                if (supports !== true) {
                    if (!supports) {
                        log(`Rule %s does not support this file`, ruleName);
                    } else {
                        log(`Rule %s does not support this file: %s`, ruleName, supports);
                    }
                    continue;
                }
            }
            rules.push({ruleName, options, severity, ctor});
        }
        return rules;
    }

    private applyRules(
        sourceFile: ts.SourceFile,
        getProgram: (() => ts.Program) | undefined,
        rules: PreparedRule[],
        settings: Map<string, any>,
        options: LinterOptions,
    ) {
        const result: Finding[] = [];
        let findingFilter: FindingFilter | undefined;
        let ruleName: string;
        let severity: Severity;
        let ctor: RuleConstructor;
        let convertedAst: ConvertedAst | undefined;

        const getFindingFilter = () => {
            return findingFilter ||
                (findingFilter = this.filterFactory.create({sourceFile, getWrappedAst, ruleNames: rules.map((r) => r.ruleName)}));
        };
        const addFinding = (pos: number, end: number, message: string, fix?: Replacement | ReadonlyArray<Replacement>) => {
            const finding: Finding = {
                ruleName,
                severity,
                message,
                start: {
                    position: pos,
                    ...ts.getLineAndCharacterOfPosition(sourceFile, pos),
                },
                end: {
                    position: end,
                    ...ts.getLineAndCharacterOfPosition(sourceFile, end),
                },
                fix: fix === undefined
                    ? undefined
                    : !Array.isArray(fix)
                        ? {replacements: [fix]}
                        : fix.length === 0
                            ? undefined
                            : {replacements: fix},
            };
            if (getFindingFilter().filter(finding))
                result.push(finding);
        };

        const context: { -readonly [K in keyof RuleContext]: RuleContext[K] } = {
            addFinding,
            getFlatAst,
            getWrappedAst,
            get program() { return getProgram && getProgram(); },
            sourceFile,
            settings,
            options: undefined,
        };

        for ({ruleName, severity, ctor, options: context.options} of rules) {
            log('Executing rule %s', ruleName);
            new ctor(context).apply();
        }

        log('Found %d findings', result.length);
        if (options.reportUselessDirectives !== undefined) {
            const useless = getFindingFilter().reportUseless(options.reportUselessDirectives);
            log('Found %d useless directives', useless.length);
            result.push(...useless);
        }
        return result;

        function getFlatAst() {
            return (convertedAst || (convertedAst = convertAst(sourceFile))).flat;
        }
        function getWrappedAst() {
            return (convertedAst || (convertedAst = convertAst(sourceFile))).wrapped;
        }
    }
}

interface PreparedRule {
    ctor: RuleConstructor;
    options: any;
    ruleName: string;
    severity: Severity;
}
