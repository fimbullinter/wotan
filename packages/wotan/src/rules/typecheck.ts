import { TypedRule } from '../types';
import * as ts from 'typescript';

export class Rule extends TypedRule {
    public apply() {
        for (const diagnostic of ts.getPreEmitDiagnostics(this.program, this.sourceFile)) {
            const start = diagnostic.start || 0;
            const end = start + (diagnostic.length || 0);
            this.addFailure(start, end, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        }
    }
}
