import { TypedRule, Replacement } from '@fimbul/ymir';
import {
    isTryStatement,
    isFunctionScopeBoundary,
    isReturnStatement,
    isParenthesizedExpression,
    isThenableType,
    WrappedAst,
    getWrappedNodeAtPosition,
    isIfStatement,
    isIterationStatement,
    isSwitchStatement,
    isBlock,
    isLabeledStatement,
} from 'tsutils';
import * as ts from 'typescript';
import { isAsyncFunction } from '../utils';

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    private reported: ts.TryStatement[] = [];

    public apply() {
        const re = /\btry\s*[/{]/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (
                isTryStatement(node) &&
                match.index === node.tryBlock.pos - 'try'.length &&
                !this.reported.includes(node) &&
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
                return this.checkReturnExpression(node.expression);
        } else if (isIfStatement(node)) {
            if (node.elseStatement !== undefined)
                this.visitStatement(node.elseStatement);
            return this.visitStatement(node.thenStatement);
        } else if (isIterationStatement(node) || isLabeledStatement(node)) {
            return this.visitStatement(node.statement);
        } else if (isSwitchStatement(node)) {
            for (const clause of node.caseBlock.clauses)
                clause.statements.forEach(this.visitStatement, this);
        } else if (isBlock(node)) {
            return node.statements.forEach(this.visitStatement, this);
        } else if (isTryStatement(node)) {
            this.reported.push(node);
            if (node.catchClause !== undefined)
                node.catchClause.block.statements.forEach(this.visitStatement, this);
            if (node.finallyBlock !== undefined)
                node.finallyBlock.statements.forEach(this.visitStatement, this);
            return node.tryBlock.statements.forEach(this.visitStatement, this);
        }
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
