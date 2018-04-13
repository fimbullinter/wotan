import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import { isExpressionStatement, isCallExpression, isThenableType, WrappedAst, getWrappedNodeAtPosition } from 'tsutils';
import { isAsyncFunction, childStatements } from '../utils';
import * as ts from 'typescript';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        const re = /\basync\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (node.kind !== ts.SyntaxKind.AsyncKeyword || node.end !== re.lastIndex)
                continue;
            const parent = node.parent!;
            if (isAsyncFunction(parent))
                parent.body.statements.forEach(this.visitStatement, this);
        }
    }

    private visitStatement(node: ts.Statement) {
        if (isExpressionStatement(node)) {
            if (isCallExpression(node.expression) && isThenableType(this.checker, node.expression))
                this.addFailureAtNode(node, "Return value of async function call was discarded. Did you mean to 'await' its result?");
            return;
        }
        for (const statement of childStatements(node))
            this.visitStatement(statement);
    }
}
