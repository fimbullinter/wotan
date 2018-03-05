import { AbstractRule, Replacement } from '../types';
import * as ts from 'typescript';
import { isElementAccessExpression, isTextualLiteral, isValidPropertyAccess } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst())
            if (isElementAccessExpression(node) && node.argumentExpression !== undefined &&
                isTextualLiteral(node.argumentExpression) && isValidPropertyAccess(node.argumentExpression.text))
                this.addFailureAtNode(
                    node.argumentExpression,
                    `Prefer 'obj.${node.argumentExpression.text}' over 'obj[${node.argumentExpression.getText(this.sourceFile)}]'.`,
                    Replacement.replace(node.expression.end, node.end, '.' + node.argumentExpression.text),
                );
    }
}
