import * as ts from 'typescript';
import { AbstractRule, Replacement } from '@fimbul/ymir';

const FAILURE_STRING = 'Using the spread operator here is not necessary.';

export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (
                (node.kind === ts.SyntaxKind.SpreadElement &&
                    (<ts.SpreadElement>node).expression.kind === ts.SyntaxKind.ArrayLiteralExpression) ||
                (node.kind === ts.SyntaxKind.SpreadAssignment &&
                    (<ts.SpreadAssignment>node).expression.kind === ts.SyntaxKind.ObjectLiteralExpression)
            )
                this.addFailureAtNode(node, FAILURE_STRING, removeUselessSpread(<ts.SpreadElement>node));
    }
}

function removeUselessSpread(node: ts.SpreadElement): Replacement[] {
    return [
        Replacement.delete(node.getStart(), node.expression.getStart() + 1),
        Replacement.delete(node.expression.end - 1, node.expression.end),
    ];
}
