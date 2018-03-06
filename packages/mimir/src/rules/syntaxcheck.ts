import { TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';

// TODO Does not require type information once https://github.com/Microsoft/TypeScript/issues/21940 is resolved
export class Rule extends TypedRule {
    public apply() {
        for (const diagnostic of this.program.getSyntacticDiagnostics(this.sourceFile)) {
            const start = diagnostic.start!;
            this.addFailure(start, start + diagnostic.length!, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        }
    }
}
