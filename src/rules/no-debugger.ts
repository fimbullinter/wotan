import { AbstractRule, Replacement } from '../types';
import * as ts from 'typescript';
import { getTokenAtPosition, isIterationStatement } from 'tsutils';

export class Rule extends AbstractRule {
    public apply() {
        const sourceFile = this.sourceFile;
        if (sourceFile.isDeclarationFile)
            return;
        const re = /\bdebugger\s*(?:;|$)/mg;
        const text = sourceFile.text;
        for (let match = re.exec(text); match !== null; match = re.exec(text)) {
            const token = getTokenAtPosition(sourceFile, match.index);
            if (token !== undefined && token.kind === ts.SyntaxKind.DebuggerKeyword) {
                const statement = <ts.DebuggerStatement>token.parent!;
                this.addFailureAtNode(
                    statement,
                    "'debugger' statements are forbidden.",
                    canSafelyRemoveStatement(statement)
                        ? Replacement.delete(token.pos, statement.end)
                        : {start: token.end - 'debugger'.length, end: statement.end, text: ';'},
                );
            }
        }
    }
}

function canSafelyRemoveStatement(statement: ts.Statement): boolean {
    switch (statement.parent!.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WithStatement:
        case ts.SyntaxKind.LabeledStatement:
            return false;
        default:
            return !isIterationStatement(statement.parent!);
    }
}
