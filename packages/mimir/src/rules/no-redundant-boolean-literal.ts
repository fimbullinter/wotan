import { AbstractRule, excludeDeclarationFiles, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isReturnStatement, isExpressionStatement, isBinaryExpression, getNextStatement, isBlock } from 'tsutils';
import { isStrictNullChecksEnabled } from '../utils';

interface Return {
    kind: 'Return';
    literal: boolean;
}

interface Assign {
    kind: 'Assign';
    expression: ts.Expression;
    literal: boolean;
}

type Use = Return | Assign;

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (node.kind === ts.SyntaxKind.IfStatement) {
                let {expression, thenStatement, elseStatement} = <ts.IfStatement>node;
                const then = detectUse(thenStatement);
                if (then === undefined)
                    continue;
                if (elseStatement === undefined) {
                    if (then.kind !== 'Return')
                        continue;
                    elseStatement = getNextStatement(<ts.IfStatement>node);
                    if (elseStatement === undefined)
                        continue;
                }
                const elze = detectUse(elseStatement);
                if (
                    elze !== undefined &&
                    elze.literal !== then.literal &&
                    (
                        elze.kind === 'Assign'
                            ? then.kind === 'Assign' && this.expressionsAreEqual(elze.expression, then.expression)
                            : then.kind === 'Return'
                    )
                ) {
                    const end = Math.max(node.end, elseStatement.end);
                    const start = node.getStart(this.sourceFile);
                    // TODO unwrap negation
                    const prefix = '!'.repeat(elze.literal ? 1 : this.isBoolean(expression) ? 0 : 2);
                    this.addFailure(start, end, `${then.kind} the condition directly.`, [
                        Replacement.replace(
                            start,
                            expression.getStart(this.sourceFile),
                            then.kind === 'Return'
                                ? `return ${prefix}`
                                : `${expression.getText(this.sourceFile)} = ${prefix}`,
                        ),
                        Replacement.replace(expression.end, end, ';'),
                    ]);
                }
            }
        }
    }

    private isBoolean(node: ts.Expression): boolean {
        if (this.program === undefined || !isStrictNullChecksEnabled(this.program.getCompilerOptions()))
            return false;
        const checker = this.program.getTypeChecker();
        let type = checker.getTypeAtLocation(node);
        type = checker.getBaseConstraintOfType(type) || type;
        return (type.flags & ts.TypeFlags.BooleanLike) !== 0;
    }

    private expressionsAreEqual(a: ts.Expression, b: ts.Expression) {
        return a.getText(this.sourceFile) === b.getText(this.sourceFile);
    }
}

function detectUse(statement: ts.Statement): Use | undefined {
    while (isBlock(statement)) {
        if (statement.statements.length !== 1)
            return;
        statement = statement.statements[0];
    }
    if (isReturnStatement(statement)) {
        if (statement.expression !== undefined) {
            if (statement.expression.kind === ts.SyntaxKind.TrueKeyword)
                return {kind: 'Return', literal: true};
            if (statement.expression.kind === ts.SyntaxKind.FalseKeyword)
                return {kind: 'Return', literal: false};
        }
    } else if (
        isExpressionStatement(statement) &&
        isBinaryExpression(statement.expression) &&
        statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
        if (statement.expression.right.kind === ts.SyntaxKind.TrueKeyword)
            return {kind: 'Assign', literal: true, expression: statement.expression.left};
        if (statement.expression.right.kind === ts.SyntaxKind.FalseKeyword)
            return {kind: 'Assign', literal: true, expression: statement.expression.left};
    }
    return;
}
