import { AbstractRule, RuleContext, AbstractFormatter, FileSummary, RuleConstructor, FormatterConstructor } from '@fimbul/wotan';
import * as TSLint from 'tslint';
import * as ts from 'typescript';

export function wrapTslintRule(Rule: TSLint.RuleConstructor, name: string): RuleConstructor { // tslint:disable-line:naming-convention
    return class extends AbstractRule {
        public static requiresTypeInformation =
            !!(Rule.metadata && Rule.metadata.requiresTypeInfo) ||
            Rule.prototype instanceof TSLint.Rules.TypedRule;

        public static supports(sourceFile: ts.SourceFile) {
            if (Rule.metadata && Rule.metadata.typescriptOnly)
                return /\.tsx?$/.test(sourceFile.fileName);
            return true;
        }

        private delegate: TSLint.IRule;

        constructor(context: RuleContext) {
            super(context);
            this.delegate = new Rule({
                ruleArguments: TSLint.Utils.arrayify(context.options),
                ruleSeverity: 'error',
                ruleName: name,
                disabledIntervals: [],
            });
        }

        public apply() {
            if (!this.delegate.isEnabled())
                return;
            let result: TSLint.RuleFailure[];
            if (this.program !== undefined && TSLint.isTypedRule(this.delegate)) {
                result = this.delegate.applyWithProgram(this.sourceFile, this.program);
            } else {
                result = this.delegate.apply(this.sourceFile);
            }
            for (const failure of result)
                this.addFailure(
                    failure.getStartPosition().getPosition(),
                    failure.getEndPosition().getPosition(),
                    failure.getFailure(),
                    arrayify(failure.getFix()).map((r) => ({start: r.start, end: r.end, text: r.text})),
                );
        }
    };
}

export function wrapTslintFormatter(Formatter: TSLint.FormatterConstructor): FormatterConstructor { // tslint:disable-line:naming-convention
    return class extends AbstractFormatter {
        private failures: TSLint.RuleFailure[] = [];
        private fixed: any[] = []; // hopefully no formatter really uses the contents of the array
        private delegate: TSLint.IFormatter;

        constructor() {
            super();
            this.delegate = new Formatter();
        }

        public format(fileName: string, summary: FileSummary): undefined {
            for (let i = 0; i < summary.fixes; ++i)
                this.fixed.push(undefined);
            if (summary.failures.length === 0)
                return;
            const sourceFile = ts.createSourceFile(fileName, summary.content, ts.ScriptTarget.Latest);
            this.failures.push(
                ...summary.failures.map((f) => new TSLint.RuleFailure(
                    sourceFile,
                    f.start.position,
                    f.end.position,
                    f.message,
                    f.ruleName,
                    f.fix && f.fix.replacements.map((r) => new TSLint.Replacement(r.start, r.end - r.start, r.text)),
                )),
            );
            return;
        }

        public flush() {
            return this.delegate.format(this.failures, this.fixed);
        }
    };
}

function arrayify<T>(maybeArr: T | T[] | undefined): T[] {
    return Array.isArray(maybeArr)
        ? maybeArr
        : maybeArr === undefined
            ? []
            : [maybeArr];
}
