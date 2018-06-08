import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isElementAccessExpression, isTextualLiteral, isValidPropertyAccess } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (isElementAccessExpression(node) &&
                // for compatiblity with typescript@<2.9.0
                node.argumentExpression !== undefined && // wotan-disable-line no-useless-predicate
                isTextualLiteral(node.argumentExpression) && isValidPropertyAccess(node.argumentExpression.text)) {
                const property = node.argumentExpression.text;
                this.addFailureAtNode(
                    node.argumentExpression,
                    `Prefer 'obj.${property}' over 'obj[${node.argumentExpression.getText(this.sourceFile)}]'.`,
                    Replacement.replace(node.expression.end, node.end, '.' + property),
                );
            }
        }
    }
}
