import { AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isElementAccessExpression, isTextualLiteral, isValidPropertyAccess } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (isElementAccessExpression(node) && node.argumentExpression !== undefined &&
                isTextualLiteral(node.argumentExpression) && isValidPropertyAccess(node.argumentExpression.text)) {
                // for compatibility with typescript@2.4
                const property = ts.unescapeIdentifier(node.argumentExpression.text); // wotan-disable-line no-unstable-api-use
                this.addFailureAtNode(
                    node.argumentExpression,
                    `Prefer 'obj.${property}' over 'obj[${node.argumentExpression.getText(this.sourceFile)}]'.`,
                    Replacement.replace(node.expression.end, node.end, '.' + property),
                );
            }
        }
    }
}
