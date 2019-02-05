import { TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';

export class Rule extends TypedRule {
    public apply() {
        for (const diagnostic of this.program.getSyntacticDiagnostics(this.sourceFile)) {
            const start = diagnostic.start;
            this.addFinding(start, start + diagnostic.length, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        }
    }
}
