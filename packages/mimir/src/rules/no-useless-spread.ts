import * as ts from 'typescript';
import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition } from 'tsutils';

const FAILURE_STRING = 'Using the spread operator here is not necessary.';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /\.{3}\s*[/[{]/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const { node } = getWrappedNodeAtPosition(
                wrappedAst || (wrappedAst = this.context.getWrappedAst()),
                match.index,
            )!;
            if (
                (node.kind === ts.SyntaxKind.SpreadElement &&
                    (<ts.SpreadElement>node).expression.kind === ts.SyntaxKind.ArrayLiteralExpression) ||
                (node.kind === ts.SyntaxKind.SpreadAssignment &&
                    (<ts.SpreadAssignment>node).expression.kind === ts.SyntaxKind.ObjectLiteralExpression)
            )
                this.addFailureAtNode(node, FAILURE_STRING, removeUselessSpread(<ts.SpreadElement>node));
        }
    }
}

function removeUselessSpread(node: ts.SpreadElement | ts.SpreadAssignment): Replacement[] {
    return [
        Replacement.delete(node.getStart(), node.expression.getStart() + 1),
        Replacement.delete(node.expression.end - 1, node.expression.end),
    ];
}
