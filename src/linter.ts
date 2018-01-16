import * as ts from 'typescript';
import {
    Failure,
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
} from './types';
import { applyFixes } from './fix';
import { getDisabledRanges, DisableMap } from './line-switches';
import * as debug from 'debug';
import { injectable } from 'inversify';
import { RuleLoader } from './services/rule-loader';
import { calculateChangeRange } from './utils';
import { ConvertedAst, convertAst } from 'tsutils';

const log = debug('wotan:linter');

export interface UpdateFileResult {
    file: ts.SourceFile;
    program?: ts.Program;
}

export type UpdateFileCallback = (content: string, range: ts.TextChangeRange) => UpdateFileResult;
export type PostprocessCallback = (failures: Failure[]) => Failure[];

@injectable()
export class Linter {
    constructor(private ruleLoader: RuleLoader, private logger: MessageHandler, private deprecationHandler: DeprecationHandler) {}

    public lintFile(file: ts.SourceFile, config: EffectiveConfiguration, program?: ts.Program): Failure[] {
        return this.getFailures(file, config, program, undefined);
    }

    public lintAndFix(
        file: ts.SourceFile,
        content: string,
        config: EffectiveConfiguration,
        updateFile: UpdateFileCallback,
        iterations: number = 10,
        program?: ts.Program,
        processor?: AbstractProcessor,
    ): LintAndFixFileResult {
        let totalFixes = 0;
        let failures = this.getFailures(file, config, program, processor);
        for (let i = 0; i < iterations; ++i) {
            if (failures.length === 0)
                break;
            const fixes = failures.map((f) => f.fix).filter(<T>(f: T | undefined): f is T => f !== undefined);
            if (fixes.length === 0) {
                log('No fixes');
                break;
            }
            log('Trying to apply %d fixes in %d. iteration', fixes.length, i + 1);
            const fixed = applyFixes(content, fixes);
            log('Applied %d fixes', fixed.fixed);
            totalFixes += fixed.fixed;
            content = fixed.result;
            let newSource: string;
            let fixedRange: ts.TextChangeRange;
            if (processor !== undefined) {
                const {transformed, changeRange} = processor.updateSource(content, fixed.range);
                fixedRange = changeRange !== undefined ? changeRange : calculateChangeRange(file.text, transformed);
                newSource = transformed;
            } else {
                newSource = content;
                fixedRange = fixed.range;
            }
            ({program, file} = updateFile(newSource, fixedRange));
            failures = this.getFailures(file, config, program, processor);
        }
        return {
            content,
            failures,
            fixes: totalFixes,
        };
    }

    // @internal
    public getFailures(
        sourceFile: ts.SourceFile,
        config: EffectiveConfiguration,
        program: ts.Program | undefined,
        processor: AbstractProcessor | undefined,
    ) {
        log('Linting file %s', sourceFile.fileName);
        const rules = this.prepareRules(config, sourceFile, program);
        if (rules.length === 0) {
            log('No active rules');
            return [];
        }
        const failures = this.applyRules(sourceFile, program, rules, config.settings);
        return processor === undefined || failures.length === 0 ? failures : processor.postprocess(failures);
    }

    private prepareRules(config: EffectiveConfiguration, sourceFile: ts.SourceFile, program: ts.Program | undefined) {
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
            if (program === undefined && ctor.requiresTypeInformation) {
                this.logger.warn(`Rule '${ruleName}' requires type information.`);
                continue;
            }
            if (ctor.supports !== undefined && !ctor.supports(sourceFile, options, config.settings)) {
                log(`Rule %s does not support this file`, ruleName);
                continue;
            }
            rules.push({ruleName, options, severity, ctor});
        }
        return rules;
    }

    private applyRules(sourceFile: ts.SourceFile, program: ts.Program | undefined, rules: PreparedRule[], settings: Map<string, any>) {
        const result: Failure[] = [];
        let disables: DisableMap | undefined;
        let ruleName: string;
        let severity: Severity;
        let ctor: RuleConstructor;
        let convertedAst: ConvertedAst | undefined;
        const context: RuleContext = {
            addFailure,
            isDisabled,
            getFlatAst,
            getWrappedAst,
            program,
            sourceFile,
            settings,
            options: undefined,
        };

        for ({ruleName, severity, ctor, options: (<any>context).options} of rules) {
            log('Executing rule %s', ruleName);
            new ctor(context).apply();
        }

        log('Found %d failures', result.length);
        return result;

        function addFailure(pos: number, end: number, message: string, fix?: Replacement | Replacement[]) {
            if (isDisabled({pos, end}))
                return;
            result.push({
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
            });
        }
        function isDisabled(range: ts.TextRange): boolean {
            if (disables === undefined)
                disables = getDisabledRanges(rules.map((r) => r.ruleName), sourceFile);
            const ruleDisables = disables.get(ruleName);
            if (ruleDisables === undefined)
                return false;
            for (const disabledRange of ruleDisables)
                if (range.end > disabledRange.pos && range.pos < disabledRange.end)
                    return true;
            return false;
        }
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
