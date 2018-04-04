import * as ts from 'typescript';
import { AbstractRule, Replacement } from '@fimbul/ymir';

const FAILURE_STRING = 'Using the spread operator here is not necessary.';

export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.SpreadElement:
                    if ((<ts.SpreadElement>node).expression.kind === ts.SyntaxKind.ArrayLiteralExpression)
                        this.addFailureAtNode(node, FAILURE_STRING, removeUselessSpread(<ts.SpreadElement>node));
                    continue;

                case ts.SyntaxKind.SpreadAssignment:
                    if ((<ts.SpreadAssignment>node).expression.kind === ts.SyntaxKind.ObjectLiteralExpression)
                        this.addFailureAtNode(node, FAILURE_STRING, removeUselessSpread(<ts.SpreadAssignment>node));
            }
        }
    }
}

function removeUselessSpread(node: ts.SpreadElement | ts.SpreadAssignment): Replacement[] {
    return [
        Replacement.delete(node.getStart(), node.expression.getStart() + 1),
        Replacement.delete(node.expression.end - 1, node.expression.end),
    ];
}
