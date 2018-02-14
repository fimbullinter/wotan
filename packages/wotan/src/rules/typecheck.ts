import { TypedRule } from '../types';
import * as ts from 'typescript';

export class Rule extends TypedRule {
    public apply() {
        this.program.getSemanticDiagnostics(this.sourceFile).forEach(this.addDiagnostic, this);
        if (this.program.getCompilerOptions().declaration)
            this.program.getDeclarationDiagnostics(this.sourceFile).forEach(this.addDiagnostic, this);
    }

    private addDiagnostic(diagnostic: ts.Diagnostic) {
        const start = diagnostic.start || 0;
        const end = start + (diagnostic.length || 0);
        this.addFailure(start, end, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
}
