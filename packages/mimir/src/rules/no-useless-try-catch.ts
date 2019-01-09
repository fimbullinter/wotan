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
            const start = tryBlock.pos - 'try'.length;
            if (tryBlock.statements.length === 0) {
                if (finallyBlock === undefined || finallyBlock.statements.length === 0) {
                    this.addFinding(
                        start,
                        node.end,
                        "'try' statement is unnecessary because the 'try' block is empty.",
                        isInSingleStatementContext(node)
                            ? Replacement.replace(start, node.end, '{}')
                            : Replacement.delete(node.pos, node.end),
                    );
                } else {
                    this.addFinding(
                        start,
                        tryBlock.end,
                        "'try' statement is unnecessary because the 'try' block is empty.",
                        canStripBlockOnRemove(node, finallyBlock)
                            ? [
                                // remove 'try {} [catch (e) {...}] finally'
                                Replacement.delete(start, finallyBlock.statements[0].getStart(this.sourceFile)),
                                Replacement.delete(finallyBlock.statements[finallyBlock.statements.length - 1].end, node.end),
                            ]
                            // remove 'try {} [catch (e) {...}] finally '
                            : Replacement.delete(start, finallyBlock.statements.pos - 1),
                    );
                }
            } else if (catchClause !== undefined && isRethrow(catchClause)) {
                if (finallyBlock === undefined) {
                    this.addFinding(
                        start,
                        node.end,
                        "'try' statement is unnecessary because the 'catch' clause only rethrows the error.",
                        canStripBlockOnRemove(node, tryBlock)
                            ? [
                                // remove 'try { '
                                Replacement.delete(start, tryBlock.statements[0].getStart(this.sourceFile)),
                                // remove ' } catch (e) { throw e; }'
                                Replacement.delete(tryBlock.statements[tryBlock.statements.length - 1].end, node.end),
                            ]
                            : [
                                // remove 'try '
                                Replacement.delete(start, tryBlock.statements.pos - 1),
                                // remove ' catch (e) { throw e; }'
                                Replacement.delete(tryBlock.end, node.end),
                            ],
                    );
                } else {
                    this.addFinding(
                        start,
                        node.end,
                        "'catch' clause is unnecessary because it only rethrows the error.",
                        Replacement.delete(start, finallyBlock.pos - 'finally'.length),
                    );
                }
            }
        }
    }
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

function canStripBlockOnRemove(node: ts.TryStatement, block: ts.Block) {
    return isInSingleStatementContext(node)
            ? block.statements.length === 1 && !isBlockScopedDeclarationStatement(block.statements[0])
        : !block.statements.some(isBlockScopedDeclarationStatement);
}
