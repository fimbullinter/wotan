import * as ts from 'typescript';
import {
    Failure,
    EffectiveConfiguration,
    LintAndFixFileResult,
    Replacement,
    RuleContext,
    Severity,
    RuleConstructor,
    TypedRuleContext,
    RuleOptions,
    GlobalSettings,
} from './types';
import { applyFixes } from './fix';
import { findRule } from './rule-loader';
import { getDisabledRanges, DisableMap } from './line-switches';
import * as debug from 'debug';
import { Container } from 'inversify';

const log = debug('wotan:linter');

export interface LintOptions {
    config: string | undefined;
    files: string[];
    exclude: string[];
    project: string | undefined;
    fix: boolean | number;
}

export function lintFile(file: ts.SourceFile, config: EffectiveConfiguration, program?: ts.Program): Failure[] {
    return getFailures(file, config, program);
}

export interface UpdateFileResult {
    file: ts.SourceFile;
    program?: ts.Program;
}

export type UpdateFileCallback = (content: string, range: ts.TextChangeRange) => UpdateFileResult;

export function lintAndFix(
    file: ts.SourceFile,
    config: EffectiveConfiguration,
    updateFile: UpdateFileCallback,
    iterations: number = 10,
    program?: ts.Program,
): LintAndFixFileResult {
    let totalFixes = 0;
    let failures = getFailures(file, config, program);
    for (let i = 0; i < iterations; ++i) {
        if (failures.length === 0)
            break;
        const fixes = failures.map((f) => f.fix).filter(<T>(f: T | undefined): f is T => f !== undefined);
        if (fixes.length === 0) {
            log('No fixes');
            break;
        }
        log('Trying to apply %d fixes in %d. iteration', fixes.length, i + 1);
        const fixed = applyFixes(file.text, fixes);
        log('Applied %d fixes', fixes.length);
        if (fixed.fixed === 0)
            break;
        totalFixes += fixed.fixed;
        ({program, file} = updateFile(fixed.result, fixed.range));
        failures = getFailures(file, config, program);
    }
    return {
        failures,
        fixes: totalFixes,
    };
}

interface PreparedRule {
    ctor: RuleConstructor;
    options: any;
    ruleName: string;
    severity: Severity;
}

function getFailures(sourceFile: ts.SourceFile, config: EffectiveConfiguration, program: ts.Program | undefined) {
    log('Linting file %s', sourceFile.fileName);
    const rules = prepareRules(config, sourceFile, program);
    if (rules.length === 0) {
        log('No active rules');
        return [];
    }
    return applyRules(sourceFile, program, rules, config.settings);
}

function prepareRules(config: EffectiveConfiguration, sourceFile: ts.SourceFile, program: ts.Program | undefined) {
    const rules: PreparedRule[] = [];
    for (const [ruleName, {options, severity, rulesDirectories, rule}] of config.rules) {
        if (severity === 'off')
            continue;
        const ctor = findRule(rule, rulesDirectories);
        if (program === undefined && ctor.requiresTypeInformation) {
            console.warn(`'${ruleName}' requires type information.`); // TODO call method on Host
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

function applyRules(sourceFile: ts.SourceFile, program: ts.Program | undefined, rules: PreparedRule[], settings: Map<string, any>) {
    const result: Failure[] = [];
    let disables: DisableMap | undefined;
    let ruleName: string;
    let severity: Severity;
    let options: any;
    let ctor: RuleConstructor;
    const context: RuleContext = {
        addFailure,
        isDisabled,
        program,
        sourceFile,
        addFailureAt(start, length, message, fix) {
            addFailure(start, start + length, message, fix);
        },
        addFailureAtNode(node, message, fix) {
            addFailure(node.getStart(sourceFile), node.end, message, fix);
        },
    };

    const container = new Container();
    container.bind<RuleContext>(RuleContext).toConstantValue(context);
    container.bind(RuleOptions).toDynamicValue(() => options);
    container.bind(GlobalSettings).toConstantValue(settings);
    if (program !== undefined)
        container.bind<RuleContext>(TypedRuleContext).toService(RuleContext);

    for ({ruleName, severity, options, ctor} of rules) {
        log('Executing rule %s', ruleName);
        container.resolve(ctor).apply();
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
}
