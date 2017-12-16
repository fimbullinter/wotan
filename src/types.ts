import * as ts from 'typescript';

export type LintResult = Map<string, FileSummary>;

export interface FileSummary extends LintAndFixFileResult {
    text: string;
}

export interface LintAndFixFileResult {
    fixes: number;
    failures: Failure[];
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
    rulesDirectory?: {[prefix: string]: string};
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
    }
}

export interface Configuration {
    rules: {[key: string]: Configuration.RuleConfig} | undefined;
    settings: {[key: string]: any} | undefined;
    filename: string;
    overrides: Configuration.Override[] | undefined;
    extends: Configuration[];
    rulesDirectory: Map<string, string> | undefined;
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
    }
}

export interface EffectiveConfiguration {
    rules: Map<string, EffectiveConfiguration.RuleConfig>;
    settings: Map<string, any>;
    rulesDirectories: Map<string, string[]>;
    processors: string[];
}

export namespace EffectiveConfiguration {
    export interface RuleConfig {
        severity: Configuration.RuleSeverity;
        options: any;
    }
}
