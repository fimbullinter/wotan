import { TypedRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isAwaitExpression,
    isForOfStatement,
    WrappedAst,
    getWrappedNodeAtPosition,
    unionTypeParts,
    getPropertyOfType,
    getIteratorYieldResultFromIteratorResult,
} from 'tsutils';
import { expressionNeedsParensWhenReplacingNode } from '../utils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        const re = /\bawait\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst ??= this.context.getWrappedAst(), match.index)!;
            if (isAwaitExpression(node)) {
                if (
                    node.expression.pos !== re.lastIndex ||
                    this.maybePromiseLike(this.checker.getTypeAtLocation(node.expression)!, node.expression)
                )
                    continue;
                const fix = [Replacement.delete(match.index, node.expression.getStart(this.sourceFile))];
                if (expressionNeedsParensWhenReplacingNode(node.expression, node))
                    fix.push(
                        Replacement.append(match.index, '('),
                        Replacement.append(node.expression.end, ')'),
                    );
                this.addFinding(
                    match.index,
                    node.end,
                    "Unnecessary 'await' of a non-Promise value.",
                    fix,
                );
            } else if (node.kind === ts.SyntaxKind.AwaitKeyword && node.end === re.lastIndex) {
                const parent = node.parent!;
                if (isForOfStatement(parent) && !this.isAsyncIterable(parent.expression)) {
                    const start = node.pos - 'for'.length;
                    this.addFinding(
                        start,
                        parent.statement.pos,
                        "Unnecessary 'for await' of a non-AsyncIterable value.",
                        Replacement.delete(start + 'for'.length, re.lastIndex),
                    );
                }
            }
        }
    }

    private maybePromiseLike(type: ts.Type, node: ts.Expression): boolean {
        type = this.checker.getApparentType(type);
        if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
            return true;
        for (const t of unionTypeParts(type))
            if (this.isThenable(t, node))
                return true;
        return false;
    }

    /**
     * A type is thenable when it has a callable `then` property.
     * We don't care if the signatures are actually callable because the compiler already complains about that.
     */
    private isThenable(type: ts.Type, node: ts.Node): boolean {
        const then = type.getProperty('then');
        return then !== undefined && this.checker.getTypeOfSymbolAtLocation(then, node).getCallSignatures().length !== 0;
    }

    private isAsyncIterable(node: ts.Expression): boolean {
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node)!);
        if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
            return true;
        for (const t of unionTypeParts(type))
            /*
             * We already know this type implements the iteration protocol, we just need to know if it involves Promises.
             * It must either be `AsyncIterable` or `Iterable<PromiseLike<any>>`.
             * We consider a type as AsyncIterable when it has a property key [Symbol.asyncIterator].
             */
            if (getPropertyOfType(t, <ts.__String>'__@asyncIterator') !== undefined || this.isIterableOfPromises(t, node))
                return true;
        return false;
    }

    private isIterableOfPromises(type: ts.Type, node: ts.Expression): boolean {
        const symbol = getPropertyOfType(type, <ts.__String>'__@iterator');
        if (symbol === undefined)
            return false;
        const t = this.checker.getTypeOfSymbolAtLocation(symbol, node);
        if (t.flags & ts.TypeFlags.Any)
            return true;
        for (const signature of t.getCallSignatures()) {
            const returnType = signature.getReturnType();
            if (returnType.flags & ts.TypeFlags.Any)
                return true;
            const next = returnType.getProperty('next');
            if (next === undefined)
                continue;
            const nextType = this.checker.getTypeOfSymbolAtLocation(next, node);
            if (nextType.flags & ts.TypeFlags.Any)
                return true;
            for (const nextSignature of nextType.getCallSignatures()) {
                const nextReturnType = getIteratorYieldResultFromIteratorResult(nextSignature.getReturnType(), node, this.checker);
                if (nextReturnType.flags & ts.TypeFlags.Any)
                    return true;
                const value = nextReturnType.getProperty('value');
                if (value !== undefined && this.maybePromiseLike(this.checker.getTypeOfSymbolAtLocation(value, node), node))
                    return true;
            }
        }
        return false;
    }
}
