import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isExpressionStatement,
    isCallExpression,
    isFunctionScopeBoundary,
    callExpressionAffectsControlFlow,
    SignatureEffect,
    isTryStatement,
} from 'tsutils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (
                isExpressionStatement(node) &&
                isCallExpression(node.expression) &&
                !ts.isOptionalChain(node.expression) &&
                this.returnsNever(node.expression) &&
                callExpressionAffectsControlFlow(node.expression, this.checker) !== SignatureEffect.Never
            )
                this.addFindingAtNode(
                    node,
                    `This call never returns, but TypeScript cannot use it for control flow analysis. Consider '${
                        isReturnAllowed(node) ? 'return' : 'throw'
                    }'ing the result to make the control flow effect explicit.`,
                );
    }

    private returnsNever(node: ts.CallExpression): boolean {
        const returnType = this.checker.getApparentType(this.checker.getResolvedSignature(node)!.getReturnType());
        return (returnType.flags & ts.TypeFlags.Never) !== 0;
    }
}

function isReturnAllowed(node: ts.Node): boolean {
    while (true) {
        node = node.parent!;
        if (
            node.kind === ts.SyntaxKind.SourceFile ||
            node.kind === ts.SyntaxKind.ModuleBlock ||
            node.kind === ts.SyntaxKind.Block && isTryStatement(node.parent!) && node.parent.tryBlock === node
        )
            return false;
        if (isFunctionScopeBoundary(node))
            return true;
    }
}
