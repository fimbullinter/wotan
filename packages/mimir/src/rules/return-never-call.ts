import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isExpressionStatement, isCallExpression, isFunctionScopeBoundary } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (isExpressionStatement(node) && isCallExpression(node.expression) && this.returnsNever(node.expression))
                this.addFailureAtNode(
                    node,
                    `This call never returns. Consider ${
                        isReturnAllowed(node) ? 'throw' : 'return'
                    }ing the result for better control flow analysis and type inference.`,
                );
    }

    private returnsNever(node: ts.CallExpression): boolean {
        const returnType = this.checker.getApparentType(this.checker.getResolvedSignature(node).getReturnType());
        return (returnType.flags & ts.TypeFlags.Never) !== 0;
    }
}

function isReturnAllowed(node: ts.Node): boolean {
    while (true) {
        node = node.parent!;
        if (node.kind !== ts.SyntaxKind.SourceFile)
            return false;
        if (isFunctionScopeBoundary(node))
            return true;
    }
}
