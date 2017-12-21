import * as ts from 'typescript';

export type LintResult = Map<string, FileSummary>;

export interface FileSummary extends LintAndFixFileResult {
    text: string;
}

export interface LintAndFixFileResult {
    fixes: number;
    failures: Failure[];
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

export interface Failure {
    start: FailurePosition;
    end: FailurePosition;
    message: string;
    ruleName: string;
    severity: Severity;
    fix: Fix | undefined;
}

export namespace Failure {
    export function compare(a: Failure, b: Failure): number {
        return a.start.position - b.start.position
            || a.end.position - b.end.position
            || compareStrings(a.ruleName, b.ruleName)
            || compareStrings(a.message, b.message);
    }
}

function compareStrings(a: string, b: string): number {
    return a < b
        ? -1
        : a > b
            ? 1
            : 0;
}

export interface FailurePosition {
    line: number;
    character: number;
    position: number;
}

export type Severity = 'error' | 'warning';

// @internal
export interface RuleConstructor {
    requiresTypeInformation: boolean;
    supports?(sourceFile: ts.SourceFile): boolean;
    new(context: RuleContext, options: any): AbstractRule;
}

export interface RuleContext {
    readonly program?: ts.Program;
    readonly sourceFile: ts.SourceFile;
    readonly settings: ReadonlyMap<string, any>;
    addFailure(this: void, start: number, end: number, message: string, fix?: Replacement | Replacement[]): void;
    addFailureAt(this: void, start: number, length: number, message: string, fix?: Replacement | Replacement[]): void;
    addFailureAtNode(this: void, node: ts.Node, message: string, fix?: Replacement | Replacement[]): void;
    /**
     * Detect if the rule is disabled somewhere in the given range.
     * A rule is considered disabled if the given range contains or overlaps a range disabled by line switches.
     * This can be used to avoid CPU intensive check if the error is ignored anyway.
     *
     * @param range The range to check for disables. If you only care about a single position, set `pos` and `end` to the same value.
     */
    isDisabled(this: void, range: ts.TextRange): boolean;
}

export interface TypedRuleContext extends RuleContext {
    readonly program: ts.Program;
}

export interface ConfigurableRule<T> {
    options: T;
    parseOptions(options: any): T;
}

function isConfigurableRule(rule: any): rule is ConfigurableRule<any> {
    return 'parseOptions' in rule;
}

export abstract class AbstractRule {
    public static readonly requiresTypeInformation: boolean = false;
    public static supports?(sourceFile: ts.SourceFile): boolean;
    public static validateConfig?(config: any): string[] | string | undefined;

    public readonly settings: ReadonlyMap<string, any>;
    public readonly sourceFile: ts.SourceFile;
    public readonly program: ts.Program | undefined;

    constructor(public readonly context: RuleContext, options: any) {
        this.settings = context.settings;
        this.sourceFile = context.sourceFile;
        this.program = context.program;
        if (isConfigurableRule(this))
            this.options = this.parseOptions(options);
    }

    public abstract apply(): void;

    public addFailure(start: number, end: number, message: string, fix?: Replacement | Replacement[]) {
        this.context.addFailure(start, end, message, fix);
    }

    public addFailureAt(start: number, length: number, message: string, fix?: Replacement | Replacement[]) {
        this.addFailure(start, start + length, message, fix);
    }

    public addFailureAtNode(node: ts.Node, message: string, fix?: Replacement | Replacement[]) {
        this.addFailure(node.getStart(this.sourceFile), node.end, message, fix);
    }
}

export abstract class TypedRule extends AbstractRule {
    public static readonly requiresTypeInformation = true;
    public readonly context: TypedRuleContext;
    public readonly program: ts.Program;
    constructor(context: TypedRuleContext, options: any) {
        super(context, options);
    }
}

export abstract class AbstractFormatter {
    public abstract format(result: LintResult): string;
}

// @internal
export interface FormatterConstructor {
    new(): AbstractFormatter;
}

export interface RawConfiguration {
    rules?: {[key: string]: RawConfiguration.RuleConfigValue};
    settings?: {[key: string]: any};
    extends?: string | string[];
    root?: boolean;
    overrides?: RawConfiguration.Override[];
    rulesDirectories?: {[prefix: string]: string};
    exclude?: string | string[];
    processor?: string;
}

export namespace RawConfiguration {
    export type RuleSeverity = 'off' | 'warn' | 'warning' | 'error';
    export interface RuleConfig {
        severity?: RuleSeverity;
        options?: any;
    }
    export type RuleConfigValue = RuleSeverity | RuleConfig;
    export interface Override {
        files: string | string[];
        rules?: {[key: string]: RawConfiguration.RuleConfigValue};
        settings?: {[key: string]: any};
        processor?: string;
    }
}

export interface Configuration {
    rules: {[key: string]: Configuration.RuleConfig} | undefined;
    settings: {[key: string]: any} | undefined;
    filename: string;
    overrides: Configuration.Override[] | undefined;
    extends: Configuration[];
    rulesDirectories: Map<string, string> | undefined;
    processor: string | undefined;
    exclude: string[] | undefined;
}

export namespace Configuration {
    export type RuleSeverity = 'off' | 'warning' | 'error';
    export interface RuleConfig {
        severity?: RuleSeverity;
        options?: any;
    }
    export interface Override {
        rules: {[key: string]: RuleConfig} | undefined;
        settings: {[key: string]: any} | undefined;
        files: string[];
        processor: string | undefined;
    }
}

export interface EffectiveConfiguration {
    rules: Map<string, EffectiveConfiguration.RuleConfig>;
    settings: Map<string, any>;
    processor: string | undefined;
}

export namespace EffectiveConfiguration {
    export interface RuleConfig {
        severity: Configuration.RuleSeverity;
        options: any;
        rulesDirectories: string[] | undefined;
    }
}

export const enum Format {
    Yaml = 'yaml',
    Json = 'json',
    Json5 = 'json5',
}
