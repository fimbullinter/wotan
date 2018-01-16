import { AbstractRule } from '../types';
import * as ts from 'typescript';
import { getControlFlowEnd, getTokenAtPosition } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        const re = /\bfinally\b/g;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const token = getTokenAtPosition(this.sourceFile, match.index)!;
            if (token.kind === ts.SyntaxKind.FinallyKeyword && token.end === re.lastIndex)
                for (const statement of getControlFlowEnd((<ts.TryStatement>token.parent).finallyBlock!).statements)
                    this.addFailureAtNode(
                        statement.getChildAt(0, this.sourceFile),
                        "Unsafe use of control flow statement inside 'finally'.",
                    );
        }
    }
}
