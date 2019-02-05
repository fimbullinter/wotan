import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isFunctionScopeBoundary, isTryStatement, WrappedAst, getWrappedNodeAtPosition, isAwaitExpression } from 'tsutils';
import { expressionNeedsParensWhenReplacingNode } from '../utils';

const FAIL_MESSAGE = 'Awaiting the returned value is redundant as it is wrapped in a Promise anyway.';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /(?:^|\|\||&&|return|=>|\*\/|[,(?:])\s*await\b/mg;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), re.lastIndex - 1)!;
            if (isAwaitExpression(node) && re.lastIndex === node.expression.pos && isUnnecessaryAwait(node)) {
                const keywordStart = node.expression.pos - 'await'.length;
                const replacements = [Replacement.delete(keywordStart, node.expression.getStart(this.sourceFile))];

                if (expressionNeedsParensWhenReplacingNode(node.expression, node))
                    replacements.push(
                        Replacement.append(keywordStart, '('),
                        Replacement.append(node.expression.end, ')'),
                    );

                this.addFinding(
                    keywordStart,
                    node.expression.pos,
                    FAIL_MESSAGE,
                    replacements,
                );
            }
        }
    }
}

function isUnnecessaryAwait(node: ts.Node): boolean {
    while (true) {
        const parent = node.parent!;
        outer: switch (parent.kind) {
            case ts.SyntaxKind.ArrowFunction:
                return true;
            case ts.SyntaxKind.ReturnStatement:
                return !isInsideTryBlock(parent.parent!);
            case ts.SyntaxKind.ParenthesizedExpression:
                break;
            case ts.SyntaxKind.ConditionalExpression:
                if ((<ts.ConditionalExpression>parent).condition === node)
                    return false;
                break;
            case ts.SyntaxKind.BinaryExpression:
                if ((<ts.BinaryExpression>parent).right === node) {
                    switch ((<ts.BinaryExpression>parent).operatorToken.kind) {
                        case ts.SyntaxKind.AmpersandAmpersandToken:
                        case ts.SyntaxKind.BarBarToken:
                        case ts.SyntaxKind.CommaToken:
                            break outer;
                    }
                }
                return false;
            default:
                return false;
        }
        node = parent;
    }
}

function isInsideTryBlock(node: ts.Node): boolean {
    while (node.parent !== undefined) {
        if (isFunctionScopeBoundary(node))
            return false; // stop at function boundaries
        if (isTryStatement(node.parent)) {
            if (
                // statements inside the try block always have an error handler, either catch or finally
                node.parent.tryBlock === node ||
                // return await inside the catch block is allowed if there is a finally block
                // otherwise the finally block is executed before the promise returned from catch resolves
                node.parent.finallyBlock !== undefined && node.parent.catchClause === node
            )
                return true;
            // we know we can skip over the TryStatement, it always has a parent
            // if it's a function or the SourceFile, we stop. or we may potentially land in another (try/catch) block
            node = node.parent.parent!;
        } else {
            node = node.parent;
        }
    }
    return false;
}
