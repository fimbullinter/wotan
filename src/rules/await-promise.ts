import { injectable } from 'inversify';
import { TypedRule, FlattenedAst, TypedRuleContext, Replacement } from '../types';
import * as ts from 'typescript';
import { isAwaitExpression, isUnionType } from 'tsutils';

@injectable()
export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    constructor(context: TypedRuleContext, private flatAst: FlattenedAst) {
        super(context);
    }

    public apply() {
        for (const node of this.flatAst)
            if (isAwaitExpression(node) && !this.isPromiseLike(node.expression))
                this.addFailure(
                    node.expression.pos - 'await'.length,
                    node.end,
                    "Unnecessary 'await' of a non-Promise value.",
                    Replacement.delete(node.expression.pos - 'await'.length, node.expression.getStart(this.sourceFile)),
                );
    }

    private isPromiseLike(node: ts.Expression): boolean {
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node));
        if (type.flags & ts.TypeFlags.Any)
            return true;
        if (!isUnionType(type))
            return this.isThenable(type, node);
        for (const t of type.types)
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
}
