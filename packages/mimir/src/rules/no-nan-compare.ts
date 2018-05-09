import { AbstractRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { WrappedAst, getWrappedNodeAtPosition, isIdentifier, isBinaryExpression, isPropertyAccessExpression } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /\bNaN\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (!isIdentifier(node) || node.text !== 'NaN' || node.end !== match.index + 3)
                continue;
            let parent = node.parent!;
            if (isPropertyAccessExpression(parent)) {
                if (!isIdentifier(parent.expression) || parent.expression.text !== 'Number')
                    continue;
                parent = parent.parent!;
            }
            if (parent.kind === ts.SyntaxKind.CaseClause || isBinaryExpression(parent) && isEqualityCheck(parent.operatorToken.kind))
                this.addFailureAtNode(parent, "Comparing with 'NaN' always yields 'false'. Consider using 'isNaN' instead.");
        }
    }
}

function isEqualityCheck(kind: ts.BinaryOperator) {
    switch (kind) {
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
        case ts.SyntaxKind.ExclamationEqualsToken:
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
        case ts.SyntaxKind.EqualsEqualsToken:
            return true;
        default:
            return false;
    }
}
