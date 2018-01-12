import * as ts from 'typescript';
import { injectable, inject } from 'inversify';
import { memoizeGetter } from './utils';
import { NodeWrap } from 'tsutils';

export type LintResult = Map<string, FileSummary>;

export type FileSummary = LintAndFixFileResult;

export interface LintAndFixFileResult {
    content: string;
    failures: Failure[];
    fixes: number;
}

export interface Replacement {
    start: number;
    end: number;
    text: string;
}

export abstract class Replacement {
    public static replace(start: number, end: number, text: string): Replacement {
        return {start, end, text};
    }
    public static append(pos: number, text: string): Replacement {
        return {start: pos, end: pos, text}; // tslint:disable-line:object-shorthand-properties-first
    }
    public static delete(start: number, end: number): Replacement {
        return {start, end, text: ''};
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
    supports?(sourceFile: ts.SourceFile, options: any, settings: ReadonlyMap<string, any>): boolean;
    new(context: RuleContext): AbstractRule;
}

export interface RuleContext {
    readonly program?: ts.Program;
    readonly sourceFile: ts.SourceFile;
    addFailure(this: void, start: number, end: number, message: string, fix?: Replacement | Replacement[]): void;
    /**
     * Detect if the rule is disabled somewhere in the given range.
     * A rule is considered disabled if the given range contains or overlaps a range disabled by line switches.
     * This can be used to avoid CPU intensive check if the error is ignored anyway.
     *
     * @param range The range to check for disables. If you only care about a single position, set `pos` and `end` to the same value.
     */
    isDisabled(this: void, range: ts.TextRange): boolean;
}
export abstract class RuleContext {}

export interface TypedRuleContext extends RuleContext {
    readonly program: ts.Program;
}
export abstract class TypedRuleContext {}

export const RuleOptions = Symbol('RuleOptions');

export interface GlobalSettings extends ReadonlyMap<string, any> {}
export abstract class GlobalSettings {}

@injectable()
export abstract class AbstractRule {
    public static readonly requiresTypeInformation: boolean = false;
    public static supports?(sourceFile: ts.SourceFile, options: any, settings: GlobalSettings): boolean;
    public static validateConfig?(config: any): string[] | string | undefined;

    public readonly sourceFile: ts.SourceFile;
    public readonly program: ts.Program | undefined;

    constructor(@inject(RuleContext) public readonly context: RuleContext) {
        this.sourceFile = context.sourceFile;
        this.program = context.program;
    }

    public abstract apply(): void;

    public addFailure(start: number, end: number, message: string, fix?: Replacement | Replacement[]) {
        return this.context.addFailure(start, end, message, fix);
    }

    public addFailureAtNode(node: ts.Node, message: string, fix?: Replacement | Replacement[]) {
        return this.addFailure(node.getStart(this.sourceFile), node.end, message, fix);
    }
}

export abstract class TypedRule extends AbstractRule {
    public static readonly requiresTypeInformation = true;
    public readonly context: TypedRuleContext;
    public readonly program: ts.Program;

    /** Lazily evaluated getter for TypeChecker. Use this instead of `this.program.getTypeChecker()` to avoid wasting CPU cycles. */
    @memoizeGetter
    public get checker() {
        return this.program.getTypeChecker();
    }

    constructor(context: TypedRuleContext) {
        super(context);
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
    aliases?: {[prefix: string]: {[name: string]: RawConfiguration.Alias | null}};
    rules?: {[key: string]: RawConfiguration.RuleConfigValue};
    settings?: {[key: string]: any};
    extends?: string | string[];
    overrides?: RawConfiguration.Override[];
    rulesDirectories?: {[prefix: string]: string};
    exclude?: string | string[];
    processor?: string | null | false;
}

export namespace RawConfiguration {
    export type RuleSeverity = 'off' | 'warn' | 'warning' | 'error';
    export interface RuleConfig {
        severity?: RuleSeverity;
        options?: any;
    }
    export type RuleConfigValue = RuleSeverity | RuleConfig | null;
    export interface Override {
        files: string | string[];
        rules?: {[key: string]: RawConfiguration.RuleConfigValue};
        settings?: {[key: string]: any};
        processor?: string | null | false;
    }
    export interface Alias {
        rule: string;
        options?: any;
    }
}

export interface Configuration {
    aliases?: {[name: string]: Configuration.Alias | null};
    rules?: {[key: string]: Configuration.RuleConfig};
    settings?: {[key: string]: any};
    filename: string;
    overrides?: Configuration.Override[];
    extends: Configuration[];
    rulesDirectories?: Map<string, string>;
    processor?: string | null | false;
    exclude?: string[];
}

export namespace Configuration {
    export type RuleSeverity = 'off' | 'warning' | 'error';
    export interface RuleConfig {
        severity?: RuleSeverity;
        options?: any;
    }
    export interface Override {
        rules?: {[key: string]: RuleConfig};
        settings?: {[key: string]: any};
        files: string[];
        processor?: string | null | false;
    }
    export interface Alias {
        rule: string;
        options?: any;
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
        rule: string;
    }
}

export const enum Format {
    Yaml = 'yaml',
    Json = 'json',
    Json5 = 'json5',
}

// @internal
export interface ProcessorConstructor {
    transformName(fileName: string, settings: ReadonlyMap<string, any>): string;
    new(source: string, sourceFileName: string, targetFileName: string, settings: ReadonlyMap<string, any>): AbstractProcessor;
}

export interface ProcessorUpdateResult {
    transformed: string;
    changeRange?: ts.TextChangeRange;
}

export abstract class AbstractProcessor {
    /**
     * Returns the resulting file name.
     */
    public static transformName(fileName: string, _settings: ReadonlyMap<string, any>): string {
        return fileName;
    }

    constructor(
        protected source: string,
        protected sourceFileName: string,
        protected targetFileName: string,
        protected settings: ReadonlyMap<string, any>,
    ) {}

    public abstract preprocess(): string;

    public abstract postprocess(failures: Failure[]): Failure[];

    public abstract updateSource(newSource: string, changeRange: ts.TextChangeRange): ProcessorUpdateResult;
}

export interface MessageHandler {
    log(message: string): void;
    warn(message: string): void;
    error(e: Error): void;
}
export abstract class MessageHandler {}

export interface DeprecationHandler {
    handle(target: DeprecationTarget, name: string, text?: string): void;
}
export abstract class DeprecationHandler {}

export const enum DeprecationTarget {
    Rule = 'rule',
    Processor = 'processor',
    Formatter = 'formatter',
}

/**
 * Low level file system access. All methods are supposed to throw an error on failure.
 */
export interface FileSystem {
    /** Normalizes the path to enable reliable caching in consuming services. */
    normalizePath(path: string): string;
    /** Reads the given file. Tries to infer and convert encoding. */
    readFile(file: string): string;
    /** Reads directory entries. Returns only the basenames. */
    readDirectory(dir: string): string[];
    /** Gets the status of a file or directory. */
    stat(path: string): Stats;
    /** Gets the realpath of a given file or directory. */
    realpath?(path: string): string;
    /** Writes content to the file, overwriting the existing content. Creates the file if necessary. */
    writeFile(file: string, content: string): void;
    /** Deletes a given file. Is not supposed to delete or clear a directory. */
    deleteFile(path: string): void;
    /** Creates a single directory and fails on error. Is not supposed to create multiple directories. */
    createDirectory(dir: string): void;
}
export abstract class FileSystem {}

export interface Stats {
    isDirectory(): boolean;
    isFile(): boolean;
}

export interface RuleLoaderHost {
    loadCoreRule(name: string): RuleConstructor | undefined;
    loadCustomRule(name: string, directory: string): RuleConstructor | undefined;
}
export abstract class RuleLoaderHost {}

export interface FormatterLoaderHost {
    loadCoreFormatter(name: string): FormatterConstructor | undefined;
    loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined;
}
export abstract class FormatterLoaderHost {}

export interface CacheManager {
    /** Returns the existing cache if one exists for the given id. */
    get<K, V>(id: CacheIdentifier<K, V>): Cache<K, V> | undefined;
    /** Returns the existing cache or creates a new one for the given id. */
    create<K, V>(id: CacheIdentifier<K, V>): Cache<K, V>;
}
export abstract class CacheManager {}

export interface Cache<K, V> {
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    delete(key: K): void;
    has(key: K): boolean;
    clear(): void;
}

export class CacheIdentifier<K, V> {
    public readonly weak: boolean = false;
    protected key: K;
    protected value: V;
    constructor(public description: string) {}
}
export class WeakCacheIdentifier<K extends object, V> extends CacheIdentifier<K, V> {
    public readonly weak = true;
}

export interface Resolver {
    resolve(id: string, basedir: string, extensions: string[], paths?: string[]): string;
    require(id: string, options?: {cache?: boolean}): any;
}
export abstract class Resolver {}

export interface DirectoryService {
    getCurrentDirectory(): string;
    getHomeDirectory?(): string;
}
export abstract class DirectoryService {}

export interface WrappedAst extends NodeWrap {} // tslint:disable-line:no-empty-interface
export abstract class WrappedAst {}
export interface FlattenedAst extends ReadonlyArray<ts.Node> {}
export abstract class FlattenedAst {}
