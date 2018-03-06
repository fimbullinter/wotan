import { AbstractRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isBlockScopedVariableDeclarationList,
    hasModifier,
    isBlock,
    getControlFlowEnd,
    endsControlFlow,
    isLabeledStatement,
} from 'tsutils';

type ForDoWhileStatement = ts.ForStatement | ts.WhileStatement | ts.DoStatement;

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.Block:
                case ts.SyntaxKind.CaseClause:
                case ts.SyntaxKind.DefaultClause:
                    this.checkBlock(<ts.BlockLike>node);
                    break;
                case ts.SyntaxKind.IfStatement:
                    this.checkIfStatement(<ts.IfStatement>node);
                    break;
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.WhileStatement:
                    this.checkConstantIterationCondition(<ForDoWhileStatement>node);
            }
        }
    }

    private checkBlock(node: ts.BlockLike) {
        let i = node.statements.findIndex(nextStatementIsUnreachable);
        if (i === -1 || i === node.statements.length - 1)
            return;
        for (i += 1; i < node.statements.length; ++i)
            if (isExecutableStatement(node.statements[i]))
                return this.report(node.statements[i]);
    }

    private checkIfStatement(node: ts.IfStatement) {
        switch (getConstantCondition(node.expression)) {
            case false:
                return this.report(node.thenStatement);
            case true:
                if (node.elseStatement !== undefined)
                    this.report(node.elseStatement);
        }
    }

    private checkConstantIterationCondition(node: ForDoWhileStatement) {
        if (getConstantIterationCondition(node) === false)
            this.report(node.statement);
    }

    private report(node: ts.Statement) {
        while (true) {
            if (isLabeledStatement(node)) {
                node = node.statement;
            } else if (isBlock(node)) {
                const next = node.statements.find(isExecutableStatement);
                if (next === undefined)
                    return;
                node = next;
            } else {
                break;
            }
        }
        this.addFailureAtNode(node.getFirstToken(this.sourceFile), 'Unreachable code detected.');
    }
}

function nextStatementIsUnreachable(statement: ts.Statement): boolean {
    if (endsControlFlow(statement))
        return true;
    const labels: string[] = [];
    while (isLabeledStatement(statement)) {
        labels.push(statement.label.text);
        statement = statement.statement;
    }
    switch (statement.kind) {
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
            // statements after loops, that go on forever without breaking, are never executed
            return getConstantIterationCondition(<ForDoWhileStatement>statement) === true &&
                !getControlFlowEnd((<ts.IterationStatement>statement).statement).statements.some(
                    (jump) => jump.kind === ts.SyntaxKind.BreakStatement && (jump.label === undefined || labels.includes(jump.label.text)),
                );
    }
    return false;
}

function isExecutableStatement(node: ts.Statement): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.EmptyStatement:
            return false;
        case ts.SyntaxKind.EnumDeclaration:
            return !hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword);
        case ts.SyntaxKind.VariableStatement:
            return isBlockScopedVariableDeclarationList((<ts.VariableStatement>node).declarationList) ||
                (<ts.VariableStatement>node).declarationList.declarations.some((d) => d.initializer !== undefined);
        case ts.SyntaxKind.Block:
            return (<ts.Block>node).statements.some(isExecutableStatement);
        case ts.SyntaxKind.LabeledStatement:
            return isExecutableStatement((<ts.LabeledStatement>node).statement);
        default:
            return true;
    }
}

function getConstantIterationCondition(statement: ForDoWhileStatement) {
    return statement.kind === ts.SyntaxKind.ForStatement
        ? statement.condition === undefined || getConstantCondition(statement.condition)
        : getConstantCondition(statement.expression);
}

function getConstantCondition(node: ts.Expression) {
    switch (node.kind) {
        case ts.SyntaxKind.TrueKeyword:
            return true;
        case ts.SyntaxKind.FalseKeyword:
            return false;
        default:
            return;
    }
}
