import { AbstractRule, ConfigurableRule } from '../types';
import * as ts from 'typescript';
import { NodeWrap, isParenthesizedExpression, isNumericLiteral, isBinaryExpression, isConditionalExpression, isExpressionStatement, isVoidExpression, isForStatement } from 'tsutils';

export interface Options {
    allowNew: boolean;
    allowTaggedTemplate: boolean;
}

export class Rule extends AbstractRule implements ConfigurableRule<Options> {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public options!: Options;

    public parseOptions(input: {} | null | undefined): Options {
        return {
            allowNew: false,
            allowTaggedTemplate: false,
            ...input,
        };
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (isExpressionStatement(node)) {
                if (!isDirective(node))
                    this.checkNode(node.expression, node);
            } else if (isForStatement(node)) {
                if (node.initializer !== undefined && node.initializer.kind !== ts.SyntaxKind.VariableDeclarationList)
                    this.checkNode(node.initializer);
                if (node.incrementor !== undefined)
                    this.checkNode(node.incrementor);
            } else if (isVoidExpression(node)) {
                if (!isAllowedVoidExpression(node.expression))
                    this.checkNode(node.expression);
            } else if (isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                // TODO (0, eval)("foo");
                this.checkNode(node.left);
            }
        }
    }

    private checkNode(expr: ts.Expression, errorNode: ts.Node = expr) {
        if (!this.isUsed(expr))
            this.addFailureAtNode(errorNode, 'This expression is unused. Did you mean to assign a value or call a function?');
    }

    private isUsed(node: ts.Expression): boolean {
        switch (node.kind) {
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.YieldExpression:
            case ts.SyntaxKind.AwaitExpression:
            case ts.SyntaxKind.DeleteExpression:
            case ts.SyntaxKind.PostfixUnaryExpression: // i++, i--
                return true;
            case ts.SyntaxKind.NewExpression:
                return this.options.allowNew;
            case ts.SyntaxKind.TaggedTemplateExpression:
                return this.options.allowTaggedTemplate;
            case ts.SyntaxKind.ParenthesizedExpression:
                return this.isUsed((<ts.ParenthesizedExpression>node).expression);
        }
        if (isBinaryExpression(node)) {

        } else if (isConditionalExpression(node)) {

        }
        return false;
    }
}

/**
 * A directive is an expression statement containing only a string literal.
 * Directives need to be located at the beginning of a function block and be consecutive.
 */
function isDirective(statement: ts.ExpressionStatement): boolean {
    if (statement.expression.kind !== ts.SyntaxKind.StringLiteral)
        return false;
    const parent = statement.parent!;
    if (!canContainDirective(parent))
        return false;
    for (let i = parent.statements.indexOf(statement) - 1; i >= 0; --i)
        if (parent.statements[i].kind !== ts.SyntaxKind.ExpressionStatement ||
            (<ts.ExpressionStatement>parent.statements[i]).expression.kind !== ts.SyntaxKind.StringLiteral)
            return false;
    return true;
}

function canContainDirective(node: ts.Node): node is ts.BlockLike {
    switch (node.kind) {
        case ts.SyntaxKind.SourceFile:
        case ts.SyntaxKind.ModuleBlock:
            return true;
        case ts.SyntaxKind.Block:
            switch (node.parent!.kind) {
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return true;
                default:
                    return false;
            }
        default:
            return false;
    }
}

function isAllowedVoidExpression(expr: ts.Expression): boolean {
    if (expr.kind === ts.SyntaxKind.ParenthesizedExpression)
        expr = (<ts.ParenthesizedExpression>expr).expression;
    return isNumericLiteral(expr) && expr.text === '0';
}
