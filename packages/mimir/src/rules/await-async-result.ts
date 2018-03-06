import { TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { NodeWrap, isFunctionScopeBoundary, isExpressionStatement, isCallExpression, isThenableType } from 'tsutils';
import { isAsyncFunction } from '../utils';

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        return this.iterate(this.context.getWrappedAst().next, undefined);
    }

    private iterate(wrap: NodeWrap, end: NodeWrap | undefined) {
        do { // iterate as linked list until we find an async function / method
            if (!isAsyncFunction(wrap.node)) {
                wrap = wrap.next!;
                continue;
            }
            wrap.children.forEach(this.visitNode, this); // visit children recursively
            wrap = wrap.skip!; // continue right after the function
        } while (wrap !== end);
    }

    private visitNode(wrap: NodeWrap) {
        if (isExpressionStatement(wrap.node)) {
            if (isCallExpression(wrap.node.expression) && isThenableType(this.checker, wrap.node.expression))
                this.addFailureAtNode(wrap.node, "Return value of async function call was discarded. Did you mean to 'await' its result?");
            // ExpressionStatement does not contain other statements (until DoExpressions land in the spec)
            return this.iterate(wrap.next!, wrap.skip);
        }
        if (isFunctionScopeBoundary(wrap.node)) // no longer in async function -> iterate as linked list
            return this.iterate(wrap, wrap.skip);

        return wrap.children.forEach(this.visitNode, this);
    }
}
