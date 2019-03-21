import { TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isCompilerOptionEnabled } from 'tsutils';

export class Rule extends TypedRule {
    public apply() {
        this.program.getSemanticDiagnostics(this.sourceFile).forEach(this.addDiagnostic, this);
        if (isCompilerOptionEnabled(this.context.compilerOptions, 'declaration'))
            this.program.getDeclarationDiagnostics(this.sourceFile).forEach(this.addDiagnostic, this);
    }

    private addDiagnostic(diagnostic: ts.Diagnostic) {
        const start = diagnostic.start!;
        this.addFinding(start, start + diagnostic.length!, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
}
