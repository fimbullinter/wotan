import { TypedRule, excludeDeclarationFiles, requiresCompilerOption, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isAssertionExpression,
    isElementAccessExpression,
    isIdentifier,
    isInterfaceDeclaration,
    isMethodSignature,
    isNonNullExpression,
    isParenthesizedExpression,
    isPropertyAccessExpression,
    isSourceFile,
    isTextualLiteral,
} from 'tsutils';
import { findMethodCalls, isUndefined } from '../utils';

@excludeDeclarationFiles
@requiresCompilerOption('strictBindCallApply')
export class Rule extends TypedRule {
    public apply() {
        for (const node of findMethodCalls(this.context, 'apply'))
            if (
                node.arguments.length === 2 &&
                node.arguments[1].kind !== ts.SyntaxKind.SpreadElement &&
                receiverMatches(node.expression.expression, node.arguments[0]) &&
                this.isFunctionPrototypeApply(<ts.Identifier>node.expression.name)
            )
                this.addFindingAtNode(
                    node,
                    `Prefer spread arguments over 'Function.prototype.apply'.`,
                    // replace '.apply(thisArg, ' with '(...'
                    Replacement.replace(
                        // preserve optional chain: 'foo?.apply(null, args)' -> 'foo?.(...args)'
                        node.expression.questionDotToken ? node.expression.name.pos : node.expression.expression.end,
                        node.arguments[1].getStart(this.sourceFile),
                        '(...',
                    ),
                );
    }

    private isFunctionPrototypeApply(methodName: ts.Identifier): boolean {
        const symbol = this.checker.getSymbolAtLocation(methodName);
        return symbol !== undefined &&
            symbol.valueDeclaration !== undefined &&
            isMethodSignature(symbol.valueDeclaration) &&
            isInterfaceDeclaration(symbol.valueDeclaration.parent!) &&
            symbol.valueDeclaration.parent.name.text === 'CallableFunction' &&
            isSourceFile(symbol.valueDeclaration.parent!.parent!) &&
            symbol.valueDeclaration.parent!.parent!.hasNoDefaultLib;
    }
}

function receiverMatches(callee: ts.Expression, arg0: ts.Expression): boolean {
    callee = unwrapParenthesesAndAssertions(callee); // foo!.apply(null, args)
    if (isIdentifier(callee)) // foo.apply(null, args)
        return arg0.kind === ts.SyntaxKind.NullKeyword || isUndefined(arg0);
    return (isPropertyAccessExpression(callee) || isElementAccessExpression(callee)) && isMatchingReference(callee.expression, arg0);
}

function isMatchingReference(a: ts.Expression, b: ts.Expression): boolean {
    a = unwrapParenthesesAndAssertions(a);
    b = unwrapParenthesesAndAssertions(b);
    if (isIdentifier(a)) // foo.bar.apply(foo, args)
        return isIdentifier(b) && a.escapedText === b.escapedText;
    if (a.kind === ts.SyntaxKind.ThisKeyword || a.kind === ts.SyntaxKind.SuperKeyword)
        return b.kind === ts.SyntaxKind.ThisKeyword; // this.foo.apply(this, args) and super.foo.apply(this, args)
    if (isPropertyAccessExpression(a))
        return isPropertyAccessExpression(b) // foo.bar.baz(foo.bar, args)
            ? a.name.escapedText === b.name.escapedText && isMatchingReference(a.expression, b.expression)
            : isElementAccessExpression(b) && // foo.bar.baz(foo['bar'], args)
                a.name.kind === ts.SyntaxKind.Identifier &&
                isTextualLiteral(b.argumentExpression) &&
                a.name.text === b.argumentExpression.text &&
                isMatchingReference(a.expression, b.expression);
    if (isElementAccessExpression(a))
        return isPropertyAccessExpression(b) // foo['bar'].baz.apply(foo.bar, args)
            ? b.name.kind === ts.SyntaxKind.Identifier &&
                isTextualLiteral(a.argumentExpression) &&
                b.name.text === a.argumentExpression.text &&
                isMatchingReference(a.expression, b.expression)
            : isElementAccessExpression(b) && // foo['bar'].baz.apply(foo['bar'], args)
                (
                    isTextualOrNumericLiteral(a.argumentExpression) // foo['bar'].baz.apply(foo['bar'], args)
                        ? isTextualOrNumericLiteral(b.argumentExpression) && a.argumentExpression.text === b.argumentExpression.text
                        : isMatchingReference(a.argumentExpression, b.argumentExpression) // arr[i].fn.apply(arr[i], args)
                ) &&
                isMatchingReference(a.expression, b.expression);
    return false;
}

function unwrapParenthesesAndAssertions(node: ts.Expression) {
    while (isParenthesizedExpression(node) || isAssertionExpression(node) || isNonNullExpression(node))
        node = node.expression;
    return node;
}

function isTextualOrNumericLiteral(node: ts.Expression): node is ts.StringLiteralLike | ts.NumericLiteral {
    switch (node.kind) {
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        case ts.SyntaxKind.NumericLiteral:
            return true;
    }
    return false;
}
