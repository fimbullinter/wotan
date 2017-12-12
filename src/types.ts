import * as ts from 'typescript';

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
    fileName: string;
    ruleName: string;
    severity: Severity;
    fix: Fix | undefined;
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
    public abstract format(failures: Failure[], fixed: number): string;
}

// @internal
export interface FormatterConstructor {
    new(): AbstractFormatter;
}
