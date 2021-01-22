import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isVariableDeclarationList,
    isNumericLiteral,
    isPrefixUnaryExpression,
    isPostfixUnaryExpression,
    isBinaryExpression,
    isIdentifier,
    isPropertyAccessExpression,
    collectVariableUsage,
    VariableUse,
    isElementAccessExpression,
    getAccessKind,
    AccessKind,
} from 'tsutils';
import { isExpressionIterable } from '../iteration';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    private get usage() {
        const usage = collectVariableUsage(this.sourceFile);
        Object.defineProperty(this, 'usage', {
            value: usage,
            writable: false,
        });
        return usage;
    }

    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.ForStatement)
                this.checkForStatement(<ts.ForStatement>node);
    }

    private checkForStatement(node: ts.ForStatement) {
        if (node.initializer === undefined || node.condition === undefined || node.incrementor === undefined)
            return;
        const indexVariable = extractIndexVariable(node.initializer, node.incrementor);
        if (indexVariable === undefined)
            return;
        const arrayVariable = extractArrayVariable(node.condition, indexVariable.text);
        if (arrayVariable === undefined)
            return;
        if (!isReadonlyArrayAccess(this.usage.get(indexVariable)!.uses, arrayVariable.getText(this.sourceFile), node, this.sourceFile))
            return;
        if (isExpressionIterable(arrayVariable, this.checker, this.context.compilerOptions, true))
            this.addFinding(
                node.getStart(this.sourceFile),
                node.statement.pos,
                `Prefer a 'for-of' loop over a 'for' loop for this simple iteration.`,
            );
    }
}

function isReadonlyArrayAccess(uses: VariableUse[], arrayVariable: string, statement: ts.ForStatement, sourceFile: ts.SourceFile): boolean {
    let arrayAccess = false;
    for (const {location: use} of uses) {
        if (use.pos < statement.pos || use.end > statement.end)
            return false; // used outside of the loop
        if (use.pos < statement.statement.pos)
            continue; // uses in loop header are already checked
        const parent = use.parent!;
        if (!isElementAccessExpression(parent) ||
            parent.argumentExpression !== use ||
            parent.expression.getText(sourceFile) !== arrayVariable ||
            getAccessKind(parent) & AccessKind.Modification)
            return false;
        arrayAccess = true;
    }
    return arrayAccess; // needs at least one array access
}

function extractArrayVariable(condition: ts.Expression, indexVariable: string): ts.Expression | undefined {
    if (!isBinaryExpression(condition))
        return;
    let left: ts.Expression;
    let right: ts.Expression;
    switch (condition.operatorToken.kind) {
        case ts.SyntaxKind.LessThanToken:
            // i < foo.length
            ({left, right} = condition);
            break;
        case ts.SyntaxKind.GreaterThanToken:
            // foo.length > i
            ({left: right, right: left} = condition);
            break;
        default:
            return;
    }
    if (!isVariable(left, indexVariable) || !isPropertyAccessExpression(right) || right.name.text !== 'length')
        return;
    return right.expression;
}

function extractIndexVariable(initializer: ts.ForInitializer, incrementor: ts.Expression): ts.Identifier | undefined {
    // there must be only one variable declared
    if (!isVariableDeclarationList(initializer) ||
        initializer.declarations.length !== 1)
        return;
    const declaration = initializer.declarations[0];
    // variable must be initialized to 0
    if (declaration.name.kind !== ts.SyntaxKind.Identifier || declaration.initializer === undefined ||
        !isNumber(declaration.initializer, 0))
        return;
    // variable must be incremented by one
    if (!isIncrementedByOne(incrementor, declaration.name.text))
        return;
    return declaration.name;
}

function isIncrementedByOne(node: ts.Expression, name: string): boolean {
    if (isPostfixUnaryExpression(node) || isPrefixUnaryExpression(node))
        // ++var or var++
        return node.operator === ts.SyntaxKind.PlusPlusToken && isVariable(node.operand, name);
    if (!isBinaryExpression(node))
        return false;
    switch (node.operatorToken.kind) {
        case ts.SyntaxKind.PlusEqualsToken:
            // var += 1
            return isVariable(node.left, name) && isNumber(node.right, 1);
        case ts.SyntaxKind.EqualsToken:
            // var = var + 1 or var = 1 + var
            return isVariable(node.left, name) &&
                isBinaryExpression(node.right) && node.right.operatorToken.kind === ts.SyntaxKind.PlusToken &&
                (
                    isVariable(node.right.left, name) && isNumber(node.right.right, 1) ||
                    isNumber(node.right.left, 1) && isVariable(node.right.right, name)
                );
        default:
            return false;
    }
}

function isVariable(node: ts.Expression, name: string): boolean {
    return isIdentifier(node) && node.text === name;
}

function isNumber(node: ts.Expression, value: number): boolean {
    return isNumericLiteral(node) && node.text === String(value);
}
