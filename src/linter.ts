import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { EffectiveConfig } from './configuration';

const CORE_RULES_DIRECTORY = path.join(__dirname, 'rules');
const RULE_CACHE = new Map<string, RuleConstructor | null>();

export function lint(file: ts.SourceFile, config: EffectiveConfig, program?: ts.Program): Failure[] {
    return getFailures(file, config, program);
}

export interface LintAndFixResult {
    fixes: number;
    failures: Failure[];
}

export interface UpdateFileResult {
    file: ts.SourceFile;
    program?: ts.Program;
}

export type UpdateFileCallback = (content: string, range: ts.TextChangeRange) => UpdateFileResult;

export function lintAndFix(
    file: ts.SourceFile,
    config: EffectiveConfig,
    updateFile: UpdateFileCallback,
    iterations: number = 10,
    program?: ts.Program,
): LintAndFixResult {
    let totalFixes = 0;
    let failures = getFailures(file, config, program);
    for (let i = 0; i < iterations; ++i) {
        if (failures.length === 0)
            break;
        const fixes = failures.map((f) => f.fix).filter(<T>(f: T | undefined): f is T => f !== undefined);
        if (fixes.length === 0)
            break;
        const fixed = applyFixes(file.text, fixes);
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

function getFailures(file: ts.SourceFile, config: EffectiveConfig, program: ts.Program | undefined) {
    const result: Failure[] = [];
    for (const [ruleName, {severity, options}] of config.rules) {
        if (severity === 'off')
            continue;
        const ctor = findRule(ruleName, config.rulesDirectories);
        if (program === undefined && ctor.requiresTypeInformation) {
            console.warn(`'${ruleName}' requires type information.`);
            continue;
        }
        const rule = new ctor(file, options, config.settings, program);
        rule.apply();
        for (const failure of rule.getFailures())
            result.push({
                ruleName,
                severity: severity === 'warn' ? 'warning' : severity,
                message: failure.message,
                start: {
                    position: failure.start,
                    ...ts.getLineAndCharacterOfPosition(file, failure.start),
                },
                end: {
                    position: failure.end,
                    ...ts.getLineAndCharacterOfPosition(file, failure.end),
                },
                fileName: file.fileName,
                fix: failure.fix === undefined
                    ? undefined
                    : !Array.isArray(failure.fix)
                        ? {replacements: [failure.fix]}
                        : failure.fix.length === 0
                            ? undefined
                            : {replacements: failure.fix},
            });
    }
    return result;
}

interface FixResult {
    result: string;
    fixed: number;
    range: ts.TextChangeRange;
}

/**
 * Tries to apply all fixes. The replacements of all fixes are sorted by index ascending.
 * They are then applied in order. If a a replacement overlaps (or touches) the range of the previous replacement,
 * the process rolls back to the state before the first replacement of the offending fix was applied. The replacements
 * of this fix are not applied again.
 */
function applyFixes(source: string, fixes: Fix[]): FixResult {
    interface FixWithState extends Fix {
        state: Record<'position' | 'index' | 'length', number> | undefined;
        skip: boolean;
    }
    let fixed = fixes.length;
    const replacements = [];
    for (const fix of fixes) {
        // TODO combine adjacent replacements
        const state: FixWithState = {replacements: fix.replacements, skip: false, state: undefined};
        for (const replacement of fix.replacements)
            replacements.push({fix: state, ...replacement});
    }
    const range: ts.TextChangeRange = {
        span: {
            start: 0,
            length: 0,
        },
        newLength: 0,
    };
    let output = '';
    let position = -1;
    replacements.sort((a, b) => a.start - b.start);
    for (let i = 0; i < replacements.length; ++i) {
        const replacement = replacements[i];
        if (replacement.fix.skip)
            continue; // there was a conflict, don't use replacements of this fix
        if (replacement.start <= position) {
            // ranges overlap (or have touching boundaries) -> don't fix to prevent unspecified behavior
            if (replacement.fix.state !== undefined) {
                // rollback to state before the first replacement of the fix was applied
                output = output.substring(0, replacement.fix.state.length);
                ({position, index: i} = replacement.fix.state);
            }
            replacement.fix.skip = true;
            --fixed;
            continue;
        }
        // only save the current state if the fix contains more replacements and there isn't already a state
        if (replacement.fix.replacements.length !== 1 && replacement.fix.state === undefined)
            replacement.fix.state = {position, index: i, length: output.length};
        if (position === -1) {
            // we are about to apply the first fix
            range.span.start = replacement.start;
            output = source.substring(0, replacement.start);
        } else {
            output += source.substring(position, replacement.start);
        }
        output += replacement.text;
        position = replacement.end;
    }
    output += source.substring(position);

    range.span.length = position - range.span.start;
    range.newLength = range.span.length + output.length - source.length;
    return {
        fixed,
        range,
        result: output,
    };
}

interface RuleConstructor {
    requiresTypeInformation: boolean;
    new(sourceFile: ts.SourceFile, options: any, settings: Map<string, any>, program?: ts.Program): AbstractRule;
}

export abstract class AbstractRule {
    public static readonly requiresTypeInformation: boolean = false;
    constructor(public sourceFile: ts.SourceFile, public options: any, public settings: Map<string, any>, public program?: ts.Program) {}
    private failures: RuleFailure[] = [];
    public validateConfig?(): string[] | string | undefined;
    public abstract apply(): void;

    public addFailure(start: number, end: number, message: string, fix?: Replacement | Replacement[]) {
        this.failures.push({start, end, message, fix});
    }

    public addFailureAt(start: number, length: number, message: string, fix?: Replacement | Replacement[]) {
        this.addFailure(start, start + length, message, fix);
    }

    public addFailureAtNode(node: ts.Node, message: string, fix?: Replacement | Replacement[]) {
        this.addFailure(node.getStart(this.sourceFile), node.end, message, fix);
    }

    public getFailures(): ReadonlyArray<Readonly<RuleFailure>> {
        return this.failures;
    }
}

export abstract class TypedRule extends AbstractRule {
    public static readonly requiresTypeInformation = true;
    public program: ts.Program;
    constructor(sourceFile: ts.SourceFile, options: any, settings: Map<string, any>, program: ts.Program) {
        super(sourceFile, options, settings, program);
    }
}

export interface RuleFailure {
    start: number;
    end: number;
    message: string;
    fix?: Replacement[] | Replacement;
}

export interface Replacement {
    start: number;
    end: number;
    text: string;
}

export abstract class Replacement {
    public static append(pos: number, text: string): Replacement {
        return {text, start: pos, end: pos};
    }
    public static delete(start: number, end: number): Replacement {
        return {start, end, text: ''};
    }
    public static replaceAt(start: number, length: number, text: string): Replacement {
        return {start, text, end: start + length};
    }
    public static deleteAt(start: number, length: number): Replacement {
        return {start, end: start + length, text: ''};
    }
}

export interface Fix {
    replacements: Replacement[];
}

export namespace Failure {
    export function compare(a: Failure, b: Failure): number {
        return a.fileName === b.fileName
            ? a.start.position - b.start.position
            : a.fileName < b.fileName
                ? -1
                : 1;
    }
}

export interface FailurePosition {
    line: number;
    character: number;
    position: number;
}

export type Severity = 'error' | 'warning';

export interface Failure {
    start: FailurePosition;
    end: FailurePosition;
    message: string;
    fileName: string;
    ruleName: string;
    severity: Severity;
    fix: Fix | undefined;
}

function findRule(name: string, rulesDirectories: EffectiveConfig['rulesDirectories']): RuleConstructor {
    const slashIndex = name.lastIndexOf('/');
    if (slashIndex === -1) {
        const ctor = loadCachedRule(path.join(CORE_RULES_DIRECTORY, name), loadCoreRule);
        if (ctor === undefined)
            throw new Error(`Could not find core rule '${name}'.`);
        return ctor;
    }
    const prefix = name.substr(0, slashIndex);
    const directories = rulesDirectories.get(prefix);
    if (directories === undefined)
        throw new Error(`No 'rulesDirectory' for prefix '${prefix}'.`);
    name = name.substr(slashIndex + 1);
    for (const dir of directories) {
        const ctor = loadCachedRule(path.join(dir, name), loadCustomRule);
        if (ctor !== undefined)
            return ctor;
    }
    throw new Error(`Could not find rule '${name}' in ${directories}`);
}

function loadCachedRule(filename: string, load: typeof loadCoreRule | typeof loadCustomRule) {
    const cached = RULE_CACHE.get(filename);
    if (cached !== undefined)
        return cached === null ? undefined : cached;
    const loaded = load(filename);
    RULE_CACHE.set(filename, loaded === undefined ? null : loaded); // tslint:disable-line:no-null-keyword
    return loaded;
}

function loadCoreRule(filename: string): RuleConstructor | undefined {
    filename = filename + '.js';
    if (!fs.existsSync(filename))
        return;
    return require(filename).Rule;
}

function loadCustomRule(filename: string): RuleConstructor | undefined {
    try {
        filename = require.resolve(filename);
    } catch {
        return;
    }
    return require(filename).Rule;
}
