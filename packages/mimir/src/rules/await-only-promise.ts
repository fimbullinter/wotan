import { TypedRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isAwaitExpression, isForOfStatement, WrappedAst, getWrappedNodeAtPosition, unionTypeParts } from 'tsutils';
import { expressionNeedsParensWhenReplacingNode } from '../utils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        const re = /\bawait\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
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
            // there must either be a `AsyncIterable` or `Iterable<PromiseLike<any>>`
            if (this.hasSymbolAsyncIterator(t) || this.isIterableOfPromises(t, node))
                return true;
        return false;
    }

    /**
     * We consider a type as AsyncIterable when it has a property key [Symbol.asyncIterator].
     * The spec requires this property to be a function returning an object with a `next` method which returns a Promise of IteratorResult.
     * But that's none of our business as the compiler already does the heavy lifting.
     */
    private hasSymbolAsyncIterator(type: ts.Type): boolean {
        return type.getProperties().some((prop) => prop.escapedName === '__@asyncIterator');
    }

    private isIterableOfPromises(type: ts.Type, node: ts.Expression): boolean {
        const symbol = type.getProperties().find((prop) => prop.escapedName === '__@iterator');
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
                const nextReturnType = nextSignature.getReturnType();
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
