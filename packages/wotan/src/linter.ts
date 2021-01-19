import * as ts from 'typescript';
import {
    Finding,
    EffectiveConfiguration,
    LintAndFixFileResult,
    Severity,
    MessageHandler,
    AbstractProcessor,
    DeprecationHandler,
    FindingFilterFactory,
    FindingPosition,
    Replacement,
} from '@fimbul/ymir';
import { applyFixes } from './fix';
import * as debug from 'debug';
import { injectable } from 'inversify';
import { RuleLoader } from './services/rule-loader';
import { calculateChangeRange, invertChangeRange } from './utils';
import { astConverter } from '@typescript-eslint/typescript-estree/dist/ast-converter';
import { Extra as AstConverterOptions } from '@typescript-eslint/typescript-estree/dist/parser-options';
import { analyze } from '@typescript-eslint/scope-manager';
import { visitorKeys } from '@typescript-eslint/visitor-keys';
import { SourceCode, Linter as EslintLinter } from 'eslint';

const log = debug('wotan:linter');

export interface LinterOptions {
    reportUselessDirectives?: Severity;
}

/** This factory is used to lazily create or update the Program only when necessary. */
export interface ProgramFactory {
    /** Get the CompilerOptions used to create the Program. */
    getCompilerOptions(): ts.CompilerOptions;
    /** This method is called to retrieve the Program on the first use. It should create or update the Program if necessary. */
    getProgram(): ts.Program;
}

class StaticProgramFactory implements ProgramFactory {
    constructor(private program: ts.Program) {}

    public getCompilerOptions() {
        return this.program.getCompilerOptions();
    }

    public getProgram() {
        return this.program;
    }
}

class CachedProgramFactory implements ProgramFactory {
    private program: ts.Program | undefined = undefined;
    private options: ts.CompilerOptions | undefined = undefined;

    constructor(private factory: ProgramFactory) {}

    public getCompilerOptions() {
        return this.options ??= this.factory.getCompilerOptions();
    }

    public getProgram() {
        if (this.program === undefined) {
            this.program = this.factory.getProgram();
            this.options = this.program.getCompilerOptions();
        }
        return this.program;
    }
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
        private _ruleLoader: RuleLoader,
        private _logger: MessageHandler,
        private _deprecationHandler: DeprecationHandler,
        private _filterFactory: FindingFilterFactory,
    ) {}

    public lintFile(
        file: ts.SourceFile,
        config: EffectiveConfiguration,
        programOrFactory?: ProgramFactory | ts.Program,
        options: LinterOptions = {},
    ): ReadonlyArray<Finding> {
        return this.getFindings(
            file,
            config,
            programOrFactory !== undefined && 'getTypeChecker' in programOrFactory
                ? new StaticProgramFactory(programOrFactory)
                : programOrFactory,
            undefined,
            options,
        );
    }

    public lintAndFix(
        file: ts.SourceFile,
        content: string,
        config: EffectiveConfiguration,
        updateFile: UpdateFileCallback,
        iterations: number = 10,
        programFactory?: ProgramFactory,
        processor?: AbstractProcessor,
        options: LinterOptions = {},
    ): LintAndFixFileResult {
        let totalFixes = 0;
        let findings = this.getFindings(file, config, programFactory, processor, options);
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
            findings = this.getFindings(file, config, programFactory, processor, options);
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
        programFactory: ProgramFactory | undefined,
        _processor: AbstractProcessor | undefined,
        options: LinterOptions,
    ): Finding[] {
        // make sure that all rules get the same Program and CompilerOptions for this run
        programFactory &&= new CachedProgramFactory(programFactory);

        // TODO find out what these mean
        const converterOptions: AstConverterOptions = {
            EXPERIMENTAL_useSourceOfProjectReferenceRedirect: false,
            code: sourceFile.text,
            comment: true,
            comments: [],
            createDefaultProgram: false,
            debugLevel: new Set(),
            errorOnTypeScriptSyntacticAndSemanticIssues: false,
            errorOnUnknownASTType: false,
            extraFileExtensions: [],
            filePath: sourceFile.fileName,
            jsx: true,
            loc: true,
            log: () => {},
            projects: [],
            range: true,
            strict: true,
            tokens: [],
            tsconfigRootDir: '',
            useJSXTextNode: true,
            preserveNodeMaps: true,
        };
        const converted = astConverter(sourceFile, converterOptions, true);
        const scopeManager = analyze(converted.estree, {
            ecmaVersion: 2020,
            sourceType: ts.isExternalModule(sourceFile) ? 'module' : 'script',
            // TODO what to do here?
        });

        const sourceCode = new SourceCode({
            text: sourceFile.text,
            ast: converted.estree as any,
            scopeManager: scopeManager as any,
            parserServices: {
                get program() {
                    return programFactory?.getProgram(); // TODO is undefined an issue?
                },
                hasFullTypeInformation: programFactory !== undefined,
                esTreeNodeToTSNodeMap: converted.astMaps.esTreeNodeToTSNodeMap,
                tsNodeToESTreeNodeMap: converted.astMaps.tsNodeToESTreeNodeMap,
            },
            visitorKeys: visitorKeys as any,
        });
        const linter = new EslintLinter({cwd: undefined});
        const linterConfig = {
            extractConfig(): EslintLinter.Config {
                const rules: EslintLinter.Config['rules'] = {};
                for (const [name, {options: ruleOptions, severity}] of config.rules) {
                    rules[name] = [severity === 'error' ? 'error' : 'warn', ruleOptions];
                };
                return {rules};
            },
            pluginRules: {
                get(ruleId: string) {
                    if (!ruleId.startsWith('@typescript-eslint/'))
                        return null;
                    const {rule, rulesDirectories} = config.rules.get(ruleId)!;
                    return require(rulesDirectories![0] + '/' + rule).default;
                }
            },
            pluginEnvironments: {
                get(envId: string) {
                    return null;
                },
            },
        };
        // TODO check whether rule requires type checking
        const result = linter.verify(sourceCode, linterConfig as any, {
            allowInlineConfig: false,
            filename: sourceFile.fileName,
            reportUnusedDisableDirectives: options.reportUselessDirectives !== undefined,
        });
        for (const m of result) {
            if ('suggestions' in m)
                console.log(m['suggestions']);
        }
        return result.map((m) => ({
            ruleName: m.ruleId ?? 'wargarbl', // TODO
            message: m.message,
            severity: m.severity === 1 ? 'warning' : 'error',
            start: mapPosition(m.line, m.column),
            end: m.endLine && m.endColumn ? mapPosition(m.endLine, m.endColumn) : mapPosition(m.line, m.column),
            fix: m.fix ? {replacements: [Replacement.replace(m.fix.range[0], m.fix.range[1], m.fix.text)]} : undefined,
        }));
        function mapPosition(line: number, col: number): FindingPosition {
            const position = ts.getPositionOfLineAndCharacter(sourceFile, line - 1, col - 1);
            return {
                position,
                line: line - 1,
                character: col - 1,
            };
        }
    }
}
