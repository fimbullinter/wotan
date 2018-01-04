import { injectable } from 'inversify';
import { TypedRule, TypedRuleContext, FlattenedAst } from '../types';
import {
    isElementAccessExpression,
    isIdentifier,
    isPropertyAccessExpression,
    getUsageDomain,
    isCallExpression,
    isNewExpression,
    isTaggedTemplateExpression,
    isJsxOpeningLikeElement,
    isUnionType,
} from 'tsutils';
import * as ts from 'typescript';

const enum Kind {
    Property = 'property',
    Variable = 'variable',
    Signature = 'signature',
}

@injectable()
export class Rule extends TypedRule {
    constructor(context: TypedRuleContext, private flatAst: FlattenedAst) {
        super(context);
    }

    public apply() {
        for (const node of this.flatAst) {
            if (isPropertyAccessExpression(node)) {
                this.checkDeprecation(node, Kind.Property);
            } else if (isElementAccessExpression(node)) {
                this.checkElementAccess(node);
            } else if (isIdentifier(node) && getUsageDomain(node) !== undefined) {
                this.checkDeprecation(node, Kind.Variable);
            } else if (
                isCallExpression(node) ||
                isNewExpression(node) ||
                isTaggedTemplateExpression(node) ||
                ts.isDecorator(node) ||
                isJsxOpeningLikeElement(node)
            ) {
                this.checkSignature(node);
            }
        }
    }

    private checkDeprecation(node: ts.Node, kind: Kind) {
        const symbol = this.checker.getSymbolAtLocation(node);
        if (symbol === undefined)
            return;
        return this.checkForDeprecation(symbol, node, kind);
    }

    private checkSignature(node: ts.CallLikeExpression) {
        const signature = this.checker.getResolvedSignature(node);
        return this.checkForDeprecation(signature, node, Kind.Signature);
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        if (node.argumentExpression === undefined)
            return;
        const type = this.checker.getTypeAtLocation(node.expression);
        const keyType = this.checker.getTypeAtLocation(node.argumentExpression);
        for (const t of isUnionType(keyType) ? keyType.types : [keyType]) {
            let symbol: ts.Symbol | undefined;
            if (t.flags & ts.TypeFlags.StringLiteral) {
                symbol = type.getProperty((<ts.StringLiteralType>t).value);
            } else if (t.flags & ts.TypeFlags.NumberLiteral) {
                symbol = type.getProperty(String((<ts.NumberLiteralType>t).value));
            }
            // TODO enum, boolean literal, ...
            if (symbol !== undefined)
                this.checkForDeprecation(symbol, node, Kind.Property);
        }
    }

    private checkForDeprecation(s: ts.Signature | ts.Symbol, node: ts.Node, kind: Kind) {
        for (const tag of s.getJsDocTags()) {
            if (tag.name === 'deprecated') {
                this.addFailureAtNode(node, `This ${kind} is deprecated${tag.text ? ': ' + tag.text : '.'}`);
                return;
            }
        }
    }
}
