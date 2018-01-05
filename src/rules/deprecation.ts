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
    isObjectBindingPattern,
    getPropertyName,
} from 'tsutils';
import * as ts from 'typescript';

const enum Kind {
    Property = 'property',
    Variable = 'variable',
    Signature = 'signature',
}

const functionLikeSymbol = ts.SymbolFlags.Function | ts.SymbolFlags.Method;

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
            } else if (isIdentifier(node) && shouldCheckIdentifier(node)) {
                this.checkDeprecation(node, Kind.Variable);
            } else if (
                isCallExpression(node) ||
                isNewExpression(node) ||
                isTaggedTemplateExpression(node) ||
                ts.isDecorator(node) ||
                isJsxOpeningLikeElement(node)
            ) {
                this.checkSignature(node);
            } else if (node.kind === ts.SyntaxKind.QualifiedName && shouldCheckQualifiedName(node)) {
                this.checkDeprecation(node, Kind.Property);
            } else if (isObjectBindingPattern(node)) {
                this.checkObjectBindingPattern(node);
            }
        }
    }

    private checkDeprecation(node: ts.Node, kind: Kind) {
        let symbol = this.checker.getSymbolAtLocation(node);
        if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias)
            symbol = this.checker.getAliasedSymbol(symbol);
        if (symbol === undefined || (symbol.flags & functionLikeSymbol) && isPartOfCall(node))
            return;
        return this.checkForDeprecation(symbol, node, kind);
    }

    private checkSignature(node: ts.CallLikeExpression) {
        const signature = this.checker.getResolvedSignature(node);
        return this.checkForDeprecation(signature, node, Kind.Signature);
    }

    private checkObjectBindingPattern(node: ts.ObjectBindingPattern) {
        const type = this.checker.getTypeAtLocation(node);
        for (const element of node.elements) {
            if (element.dotDotDotToken !== undefined)
                continue;
            if (element.propertyName === undefined) {
                const symbol = type.getProperty((<ts.Identifier>element.name).text);
                if (symbol !== undefined)
                    this.checkForDeprecation(symbol, element.name, Kind.Property);
            } else {
                const name = getPropertyName(element.propertyName);
                if (name !== undefined) {
                    const symbol = type.getProperty(name);
                    if (symbol !== undefined)
                        this.checkForDeprecation(symbol, element.propertyName, Kind.Property);
                } else {
                    const propType = this.checker.getTypeAtLocation((<ts.ComputedPropertyName>element.propertyName).expression);
                    this.checkDynamicPropertyAccess(type, propType, element.propertyName);
                }
            }
        }
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        if (node.argumentExpression === undefined)
            return;
        const type = this.checker.getTypeAtLocation(node.expression);
        const keyType = this.checker.getTypeAtLocation(node.argumentExpression);
        this.checkDynamicPropertyAccess(type, keyType, node);
    }

    private checkDynamicPropertyAccess(type: ts.Type, keyType: ts.Type, node: ts.Node) {
        for (const t of isUnionType(keyType) ? keyType.types : [keyType]) {
            if (t.flags & ts.TypeFlags.StringOrNumberLiteral) {
                const symbol = type.getProperty(String((<ts.StringLiteralType | ts.NumberLiteralType>t).value));
                if (symbol !== undefined && ((symbol.flags & functionLikeSymbol) === 0 || !isPartOfCall(node)))
                    this.checkForDeprecation(symbol, node, Kind.Property);
            }
        }
    }

    private checkForDeprecation(s: ts.Signature | ts.Symbol, node: ts.Node, kind: Kind) {
        for (const tag of s.getJsDocTags())
            if (tag.name === 'deprecated')
                this.addFailureAtNode(node, `This ${kind} is deprecated${tag.text ? ': ' + tag.text : '.'}`);
    }
}

function isPartOfCall(node: ts.Node) {
    while (true) {
        const parent = node.parent!;
        switch (parent.kind) {
            case ts.SyntaxKind.TaggedTemplateExpression:
            case ts.SyntaxKind.Decorator:
                return true;
            case ts.SyntaxKind.CallExpression:
                // note: NewExpression will never get here, because if the class is deprecated, we show an error all the time
                return (<ts.CallExpression>parent).expression === node;
            case ts.SyntaxKind.JsxOpeningElement:
            case ts.SyntaxKind.JsxSelfClosingElement:
                return (<ts.JsxOpeningLikeElement>parent).tagName === node;
            case ts.SyntaxKind.ParenthesizedExpression:
                node = parent;
                break;
            default:
                return false;
        }
    }
}

function shouldCheckIdentifier(node: ts.Identifier): boolean {
    switch (node.parent!.kind) {
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.ExportAssignment:
        case ts.SyntaxKind.ExportSpecifier:
            return false;
        default:
            return getUsageDomain(node) !== undefined;
    }
}

function shouldCheckQualifiedName(node: ts.Node): boolean {
    // if parent is a QualifiedName, it is the my.ns part of my.ns.Something -> we definitely want to check that
    // if the parent is an ImportEqualsDeclaration -> we don't want to check the rightmost identifier, because importing is not that bad
    // everything else is a TypeReference -> we want to check that
    return node.parent!.kind !== ts.SyntaxKind.ImportEqualsDeclaration;
}
