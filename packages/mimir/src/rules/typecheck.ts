import { TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';

export class Rule extends TypedRule {
    public apply() {
        this.program.getSemanticDiagnostics(this.sourceFile).forEach(this.addDiagnostic, this);
        if (this.program.getCompilerOptions().declaration)
            this.program.getDeclarationDiagnostics(this.sourceFile).forEach(this.addDiagnostic, this);
    }

    private addDiagnostic(diagnostic: ts.Diagnostic) {
        const start = diagnostic.start!;
        this.addFailure(start, start + diagnostic.length!, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
}
