import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import { isTextualLiteral, isValidPropertyAccess } from 'tsutils';
import * as ts from 'typescript';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.ElementAccessExpression)
                this.checkElementAccess(<ts.ElementAccessExpression>node);
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        if (!isTextualLiteral(node.argumentExpression))
            return;
        const {text} = node.argumentExpression;
        if (!isValidPropertyAccess(text))
            return;

        this.addFindingAtNode(
            node.argumentExpression,
            `Prefer 'obj.${text}' over 'obj[${node.argumentExpression.getText(this.sourceFile)}]'.`,
            node.expression.kind === ts.SyntaxKind.NumericLiteral
                ? [
                    Replacement.append(node.expression.getStart(this.sourceFile), '('),
                    Replacement.replace(node.expression.end, node.end, ').' + text),
                ]
                : Replacement.replace(node.expression.end, node.end, '.' + text),
        );
    }
}
