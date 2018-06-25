import { excludeDeclarationFiles, AbstractRule, Replacement } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition, isIdentifier, isPropertyAccessExpression, isCallExpression, isSpreadElement } from 'tsutils';
import { expressionNeedsParensWhenReplacingNode } from '../utils';
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
            const fix = [Replacement.replace(grandparent.arguments[1].pos - 1, grandparent.arguments[1].pos, '**')];
            const fixed = ts.createBinary(
                grandparent.arguments[0],
                ts.SyntaxKind.AsteriskAsteriskToken,
                grandparent.arguments[1],
            );
            if (
                expressionNeedsParensWhenReplacingNode(fixed, grandparent) ||
                grandparent.parent!.kind === ts.SyntaxKind.PropertyAccessExpression ||
                grandparent.parent!.kind === ts.SyntaxKind.ElementAccessExpression &&
                    (<ts.ElementAccessExpression>grandparent.parent).expression === grandparent ||
                grandparent.parent!.kind === ts.SyntaxKind.PrefixUnaryExpression ||
                grandparent.parent!.kind === ts.SyntaxKind.AwaitExpression ||
                grandparent.parent!.kind === ts.SyntaxKind.VoidExpression ||
                grandparent.parent!.kind === ts.SyntaxKind.TypeOfExpression ||
                grandparent.parent!.kind === ts.SyntaxKind.TypeAssertionExpression ||
                grandparent.parent!.kind === ts.SyntaxKind.BinaryExpression &&
                    (<ts.BinaryExpression>grandparent.parent).operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken &&
                    (<ts.BinaryExpression>grandparent.parent).left === grandparent
            ) {
                fix.push(Replacement.delete(grandparent.getStart(this.sourceFile), grandparent.arguments[0].pos - 1));
            } else {
                fix.push(
                    Replacement.delete(grandparent.getStart(this.sourceFile), grandparent.arguments[0].getStart(this.sourceFile)),
                    Replacement.delete(grandparent.end - 1, grandparent.end),
                );
            }
            if (fixed.left !== grandparent.arguments[0])
                fix.push(
                    Replacement.append(grandparent.arguments[0].getStart(this.sourceFile), '('),
                    Replacement.append(grandparent.arguments[0].end, ')'),
                );
            if (fixed.right !== grandparent.arguments[1])
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
