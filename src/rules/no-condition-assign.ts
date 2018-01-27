import { AbstractRule } from '../types';
import * as ts from 'typescript';
import { isAssignmentKind } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.IfStatement:
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.DoStatement:
                    this.checkCondition((<ts.IfStatement | ts.WhileStatement | ts.DoStatement>node).expression);
                    break;
                case ts.SyntaxKind.ForStatement:
                    if ((<ts.ForStatement>node).condition !== undefined)
                        this.checkCondition((<ts.ForStatement>node).condition!);
                    break;
                case ts.SyntaxKind.ConditionalExpression:
                    this.checkCondition((<ts.ConditionalExpression>node).condition);
            }
        }
    }

    private checkCondition(node: ts.Expression) {
        switch (node.kind) {
            case ts.SyntaxKind.BinaryExpression:
                switch ((<ts.BinaryExpression>node).operatorToken.kind) {
                    case ts.SyntaxKind.EqualsEqualsToken:
                    case ts.SyntaxKind.EqualsEqualsEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsToken:
                    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                        return;
                    default: {
                        const {left, right, operatorToken} = <ts.BinaryExpression>node;
                        this.checkCondition(left);
                        this.checkCondition(right);
                        if (isAssignmentKind(operatorToken.kind))
                            return this.addFailureAtNode(operatorToken, 'Unexpected assignment inside condition.');
                        return;
                    }
                }
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.NonNullExpression:
                return this.checkCondition((<ts.ParenthesizedExpression | ts.AssertionExpression | ts.NonNullExpression>node).expression);
            case ts.SyntaxKind.PrefixUnaryExpression:
                return this.checkCondition((<ts.PrefixUnaryExpression>node).operand);
            case ts.SyntaxKind.ConditionalExpression:
                this.checkCondition((<ts.ConditionalExpression>node).whenTrue);
                return this.checkCondition((<ts.ConditionalExpression>node).whenFalse);
        }
    }
}
