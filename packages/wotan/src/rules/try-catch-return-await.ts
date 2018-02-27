import { TypedRule, Replacement } from '../types';
import {
    NodeWrap,
    isTryStatement,
    isFunctionScopeBoundary,
    isReturnStatement,
    isParenthesizedExpression,
    isThenableType,
} from 'tsutils';
import * as ts from 'typescript';
import { isAsyncFunction } from '../rule-utils';

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    private inTryCatch = false;

    public apply() {
        return this.iterate(this.context.getWrappedAst().next, undefined, false);
    }

    private iterate(wrap: NodeWrap, end: NodeWrap | undefined, inTryCatch: boolean) {
        do { // iterate as linked list until we find an async function / method
            if (!isAsyncFunction(wrap.node)) {
                wrap = wrap.next!;
                continue;
            }
            this.inTryCatch = false;
            wrap.children.forEach(this.visitNode, this); // visit children recursively
            this.inTryCatch = inTryCatch;
            wrap = wrap.skip!; // continue right after the function
        } while (wrap !== end);
    }

    private visitNode(wrap: NodeWrap) {
        if (this.inTryCatch) {
            if (isReturnStatement(wrap.node)) {
                if (wrap.node.expression === undefined)
                    return;
                this.checkReturnExpression(wrap.node.expression);
                return this.iterate(wrap.next!, wrap.skip, true);
            }
        } else if (isTryStatement(wrap.node)) {
            this.inTryCatch = true;
            wrap.children[0].children.forEach(this.visitNode, this); // Statements in tryBlock
            if (wrap.node.catchClause !== undefined) {
                this.inTryCatch = wrap.node.finallyBlock !== undefined; // special handling for catchClause only if finallyBlock is present
                wrap.children[1].children.forEach(this.visitNode, this); // Children of catchClause
            }
            this.inTryCatch = false;
            if (wrap.node.finallyBlock !== undefined)
                wrap.children[wrap.children.length - 1].children.forEach(this.visitNode, this);
            return;
        }
        if (isFunctionScopeBoundary(wrap.node)) // no longer in async function -> iterate as linked list
            return this.iterate(wrap, wrap.skip, this.inTryCatch);
        return wrap.children.forEach(this.visitNode, this);
    }

    private checkReturnExpression(node: ts.Expression) {
        const {pos} = node;
        while (isParenthesizedExpression(node))
            node = node.expression;
        if (node.kind === ts.SyntaxKind.AwaitExpression)
            return;
        if (isThenableType(this.checker, node))
            this.addFailure(
                pos - 'return'.length,
                pos,
                "Missing 'await' of Promise returned inside try-catch.",
                needsParens(node)
                    ? [
                        Replacement.append(pos, ' await'),
                        Replacement.append(node.getStart(this.sourceFile), '('),
                        Replacement.append(node.end, ')'),
                    ]
                    : Replacement.append(pos, ' await'),
            );
    }
}

function needsParens(node: ts.Expression) {
    switch (node.kind) {
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.BinaryExpression:
            return node.parent!.kind !== ts.SyntaxKind.ParenthesizedExpression;
        default:
            return false;
    }
}
