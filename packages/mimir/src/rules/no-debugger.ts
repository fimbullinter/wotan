import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isIterationStatement, getWrappedNodeAtPosition, WrappedAst } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /\bdebugger\s*(?:[/;]|$)/mg;
        let wrappedAst: WrappedAst | undefined;
        const text = this.sourceFile.text;
        for (let match = re.exec(text); match !== null; match = re.exec(text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (node.kind === ts.SyntaxKind.DebuggerStatement) {
                const start = node.getStart(this.sourceFile);
                if (start === match.index)
                    this.addFailure(
                        start,
                        node.end,
                        "'debugger' statements are forbidden.",
                        canSafelyRemoveStatement(node)
                            ? Replacement.delete(node.pos, node.end)
                            : {start, end: node.end, text: ';'},
                    );
            }
        }
    }
}

function canSafelyRemoveStatement(statement: ts.Node): boolean {
    switch (statement.parent!.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WithStatement:
        case ts.SyntaxKind.LabeledStatement:
            return false;
        default:
            return !isIterationStatement(statement.parent!);
    }
}
