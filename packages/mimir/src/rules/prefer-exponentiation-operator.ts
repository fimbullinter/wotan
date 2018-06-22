import { excludeDeclarationFiles, AbstractRule, Replacement } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition, isIdentifier, isPropertyAccessExpression, isCallExpression, isSpreadElement } from 'tsutils';
import { expressionNeedsParensWhenReplacingNode, expressionNeedsParens } from '../utils';
import * as ts from 'typescript';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /\bpow\s*[/(]/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (!isIdentifier(node) || node.end !== match.index + 3 || node.text !== 'pow')
                continue;
            const parent = node.parent!;
            if (!isPropertyAccessExpression(parent) || !isIdentifier(parent.expression) || parent.expression.text !== 'Math')
                continue;
            const grandparent = parent.parent!;
            if (
                !isCallExpression(grandparent) ||
                grandparent.expression !== parent ||
                grandparent.arguments.length !== 2 ||
                grandparent.arguments.some(isSpreadElement)
            )
                continue;
            const fixed = ts.createBinary(
                ts.getMutableClone(grandparent.arguments[0]),
                ts.SyntaxKind.AsteriskAsteriskToken,
                ts.getMutableClone(grandparent.arguments[1]),
            );
            const fix = [Replacement.replace(grandparent.arguments[1].pos - 1, grandparent.arguments[1].pos, '**')];
            fixed.left.parent = fixed.right.parent = fixed;
            if (expressionNeedsParensWhenReplacingNode(
                    fixed,
                    grandparent,
                )) {
                fix.push(Replacement.delete(grandparent.getStart(this.sourceFile), grandparent.arguments[0].pos - 1));
            } else {
                fix.push(
                    Replacement.delete(grandparent.getStart(this.sourceFile), grandparent.arguments[0].getStart(this.sourceFile)),
                    Replacement.delete(grandparent.end - 1, grandparent.end),
                );
            }
            if (expressionNeedsParens(fixed.left))
                fix.push(
                    Replacement.append(grandparent.arguments[0].getStart(this.sourceFile), '('),
                    Replacement.append(grandparent.arguments[0].end, ')'),
                );
            if (expressionNeedsParens(fixed.right))
                fix.push(
                    Replacement.append(grandparent.arguments[1].getStart(this.sourceFile), '('),
                    Replacement.append(grandparent.arguments[1].end, ')'),
                );

            this.addFailureAtNode(
                grandparent,
                "Prefer the exponentiation operator '**' over 'Math.pow'.",
                fix,
            );
        }
    }
}
