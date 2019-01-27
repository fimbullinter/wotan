import { AbstractRule, excludeDeclarationFiles, Replacement } from '@fimbul/ymir';
import {
    isThrowStatement,
    isIdentifier,
    isInSingleStatementContext,
    isBlockScopedDeclarationStatement,
} from 'tsutils';
import * as ts from 'typescript';
import { unwrapParens, tryStatements } from '../utils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const node of tryStatements(this.context)) {
            const {tryBlock, catchClause, finallyBlock} = node;
            const start = getStart(node);
            const hasFinally = finallyBlock !== undefined && finallyBlock.statements.length !== 0;
            if (tryBlock.statements.length === 0) {
                this.addFinding(
                    start,
                    node.end,
                    "'try' statement is unnecessary because the 'try' block is empty.",
                    hasFinally ? deleteStatementLeavingBlock(node, finallyBlock!, this.sourceFile) : deleteStatement(node),
                );
            } else if (catchClause !== undefined && isRethrow(catchClause)) {
                // reminder for myself: empty catch clause can be used to simply ignore errors and is never redundant
                this.addFinding(
                    start,
                    node.end,
                    `${
                        hasFinally ? "'catch' clause" : "'try' statement"
                    } is unnecessary because the 'catch' clause only rethrows the error.`,
                    hasFinally
                        ? Replacement.delete(catchClause.getStart(this.sourceFile), finallyBlock!.pos - 'finally'.length)
                        : deleteStatementLeavingBlock(node, tryBlock, this.sourceFile),
                );
            } else if (finallyBlock !== undefined && finallyBlock.statements.length === 0) {
                if (catchClause === undefined) {
                    this.addFinding(
                        start,
                        node.end,
                        "'try' statement is unnecessary because the 'finally' block is empty.",
                        deleteStatementLeavingBlock(node, tryBlock, this.sourceFile),
                    );
                } else {
                    this.addFinding(
                        finallyBlock!.pos - 'finally'.length,
                        node.end,
                        "Empty 'finally' clause is unnecessary.",
                        Replacement.delete(catchClause.end, finallyBlock.end),
                    );
                }
            }
        }
    }
}

function deleteStatement(node: ts.TryStatement) {
    return isInSingleStatementContext(node)
        ? Replacement.replace(getStart(node), node.end, '{}')
        : Replacement.delete(node.pos, node.end);
}

function deleteStatementLeavingBlock(node: ts.TryStatement, block: ts.Block, sourceFile: ts.SourceFile) {
    const start = getStart(node);
    return canStripBlockOnRemove(node, block)
        ? [
            Replacement.delete(start, block.statements[0].getStart(sourceFile)),
            Replacement.delete(block.statements[block.statements.length - 1].end, node.end),
        ]
        : [
            Replacement.delete(start, block.statements.pos - 1),
            Replacement.delete(block.end, node.end),
        ];
}

function canStripBlockOnRemove(node: ts.TryStatement, block: ts.Block) {
    return isInSingleStatementContext(node)
            ? block.statements.length === 1 && !isBlockScopedDeclarationStatement(block.statements[0])
        : !block.statements.some(isBlockScopedDeclarationStatement);
}

function getStart(node: ts.TryStatement) {
    return node.tryBlock.pos - 'try'.length;
}

function isRethrow(node: ts.CatchClause): boolean {
    return node.variableDeclaration !== undefined &&
        node.variableDeclaration.name.kind === ts.SyntaxKind.Identifier &&
        node.block.statements.length === 1 &&
        throwsVariable(node.block.statements[0], node.variableDeclaration.name);
}

function throwsVariable(statement: ts.Statement, name: ts.Identifier): boolean {
    if (!isThrowStatement(statement) || statement.expression === undefined)
        return false;
    const expression = unwrapParens(statement.expression);
    return isIdentifier(expression) && expression.escapedText === name.escapedText;
}
