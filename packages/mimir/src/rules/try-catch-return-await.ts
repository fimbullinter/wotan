import { TypedRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import {
    isTryStatement,
    isFunctionScopeBoundary,
    isReturnStatement,
    isParenthesizedExpression,
    isThenableType,
    WrappedAst,
    getWrappedNodeAtPosition,
} from 'tsutils';
import * as ts from 'typescript';
import { isAsyncFunction, getChildStatements } from '../utils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    private reported = new Set<number>();

    public apply() {
        const re = /\btry\s*[/{]/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (
                isTryStatement(node) &&
                match.index === node.tryBlock.pos - 'try'.length &&
                !this.reported.has(node.pos) &&
                isInAsyncFunction(node)
            ) {
                node.tryBlock.statements.forEach(this.visitStatement, this);
                // special handling for catchClause only if finallyBlock is present
                if (node.catchClause !== undefined && node.finallyBlock !== undefined)
                    node.catchClause.block.statements.forEach(this.visitStatement, this);
            }
        }
    }

    private visitStatement(node: ts.Statement): void {
        if (isReturnStatement(node)) {
            if (node.expression !== undefined)
                this.checkReturnExpression(node.expression);
            return;
        }
        if (node.kind === ts.SyntaxKind.TryStatement)
            this.reported.add(node.pos);
        for (const statement of getChildStatements(node))
            this.visitStatement(statement);
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

function isInAsyncFunction(node: ts.Node): boolean {
    do {
        node = node.parent!;
        if (node.kind === ts.SyntaxKind.SourceFile)
            return false;
    } while (!isFunctionScopeBoundary(node));
    return isAsyncFunction(node);
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
