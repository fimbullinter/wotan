import { excludeDeclarationFiles, TypedRule, requiresStrictNullChecks } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isDeleteExpression,
    isElementAccessExpression,
    unionTypeParts,
    isPropertyAccessExpression,
    isIdentifier,
} from 'tsutils';
import * as ts from 'typescript';

@excludeDeclarationFiles
@requiresStrictNullChecks
export class Rule extends TypedRule {
    public apply() {
        const re = /\bdelete\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (!isDeleteExpression(node) || node.expression.pos !== re.lastIndex)
                continue;
            const {expression} = node;
            if (isElementAccessExpression(expression)) {
                const {argumentExpression} = expression;
                if (argumentExpression === undefined || argumentExpression.pos === argumentExpression.end)
                    continue;
                const expressionType = this.checker.getApparentType(this.checker.getTypeAtLocation(expression.expression)!);
                if (
                    isPropertyAccessExpression(argumentExpression) &&
                    isIdentifier(argumentExpression.expression) &&
                    argumentExpression.expression.text === 'Symbol'
                ) {
                    // handle well-known symbols
                    const name = `__@${argumentExpression.name.text}`;
                    this.checkSymbol(
                        expressionType.getProperties().find((p) => p.escapedName === name),
                        node,
                        `Symbol.${argumentExpression.name.text}`,
                    );
                } else {
                    const argumentType = this.checker.getTypeAtLocation(argumentExpression)!;
                    for (const key of getLiterals(this.checker.getBaseConstraintOfType(argumentType) || argumentType))
                        this.checkSymbol(expressionType.getProperty(key), node, key);
                }
            } else {
                this.checkSymbol(this.checker.getSymbolAtLocation(expression), node);
            }
        }
    }

    private checkSymbol(symbol: ts.Symbol | undefined, errorNode: ts.Node, name?: string) {
        if (symbol === undefined || symbol.flags & ts.SymbolFlags.Optional)
            return;
        this.addFailureAtNode(errorNode, `Only 'delete' optional properties. Property '${name || symbol.name}' is required.`);
    }
}

function getLiterals(type: ts.Type) {
    const result = [];
    for (const t of unionTypeParts(type)) {
        if (t.flags & ts.TypeFlags.StringOrNumberLiteral) {
            result.push(`${(<ts.LiteralType>t).value}`);
        } else if (t.flags & ts.TypeFlags.BooleanLiteral) {
            result.push((<{intrinsicName: string}><any>t).intrinsicName);
        }
    }
    return result;
}
