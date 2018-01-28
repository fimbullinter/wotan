import { NodeFormatterLoader } from '../default/formatter-loader-host';
import { FormatterConstructor, AbstractFormatter, FileSummary, Resolver } from '../../types';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import { injectable } from 'inversify';

@injectable()
export class TslintFormatterLoader extends NodeFormatterLoader {
    constructor(resolver: Resolver) {
        super(resolver);
    }

    public loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined {
        const result = super.loadCustomFormatter(name, basedir);
        if (result !== undefined)
            return result;
        const tslintFormatter = Lint.findFormatter(name);
        return tslintFormatter && wrapTslintFormatter(tslintFormatter);
    }
}

function wrapTslintFormatter(formatter: Lint.FormatterConstructor) {
    return class extends AbstractFormatter {
        private failures: Lint.RuleFailure[] = [];
        private fixed: any[] = []; // hopefully no formatter really uses the contents of the array
        public format(fileName: string, summary: FileSummary): undefined {
            for (let i = 0; i < summary.fixes; ++i)
                this.fixed.push(undefined);
            if (summary.failures.length === 0)
                return;
            const sourceFile = ts.createSourceFile(fileName, summary.content, ts.ScriptTarget.Latest);
            this.failures.push(
                ...summary.failures.map((f) => new Lint.RuleFailure(
                    sourceFile,
                    f.start.position,
                    f.end.position,
                    f.message,
                    f.ruleName,
                    f.fix && f.fix.replacements.map((r) => new Lint.Replacement(r.start, r.end - r.start, r.text)),
                )),
            );
            return;
        }

        public flush() {
            return new formatter().format(this.failures, this.fixed);
        }
    };
}
