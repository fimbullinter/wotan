import { TypedRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isAwaitExpression, isForOfStatement, WrappedAst, getWrappedNodeAtPosition, unionTypeParts } from 'tsutils';

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        const re = /\bawait\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (match.index !== node.getStart(this.sourceFile))
                continue;
            if (isAwaitExpression(node)) {
                if (!this.isPromiseLike(node.expression))
                    this.addFailure(
                        match.index,
                        node.end,
                        "Unnecessary 'await' of a non-Promise value.",
                        Replacement.delete(match.index, node.expression.getStart(this.sourceFile)),
                    );
            } else if (node.kind === ts.SyntaxKind.AwaitKeyword) {
                const parent = node.parent!;
                if (isForOfStatement(parent) && !this.isAsyncIterable(parent.expression)) {
                    const start = parent.getStart(this.sourceFile);
                    this.addFailure(
                        start,
                        parent.statement.pos,
                        "Unnecessary 'for await' of a non-AsyncIterable value.",
                        Replacement.delete(start + 'for'.length, re.lastIndex),
                    );
                }
            }
        }
    }

    private isPromiseLike(node: ts.Expression): boolean {
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node));
        if (type.flags & ts.TypeFlags.Any)
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
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node));
        if (type.flags & ts.TypeFlags.Any)
            return true;
        for (const t of unionTypeParts(type))
            if (this.hasSymbolAsyncIterator(t))
                return true;
        return false;
    }

    /**
     * We consider a type as AsyncIterable when it has a property key [Symbol.asyncIterator].
     * The spec requires this property to be a function returning an object with a `next` method which returns a Promise of IteratorResult.
     * But that's none of our business as the compiler already does the heavy lifting.
     */
    private hasSymbolAsyncIterator(type: ts.Type): boolean {
        return type.getProperties().some((prop) => prop.name === '__@asyncIterator'); // TODO this may break in future typescript releases
    }
}
