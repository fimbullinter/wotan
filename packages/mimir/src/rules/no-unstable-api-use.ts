import { TypedRule } from '@fimbul/ymir';
import {
    isElementAccessExpression,
    isIdentifier,
    isPropertyAccessExpression,
    getUsageDomain,
    isCallLikeExpression,
    isObjectBindingPattern,
    getPropertyName,
    isPropertyAssignment,
    isReassignmentTarget,
    isShorthandPropertyAssignment,
    getLateBoundPropertyNames,
    getLateBoundPropertyNamesOfPropertyName,
    getPropertyOfType,
} from 'tsutils';
import * as ts from 'typescript';
import { elementAccessSymbols, propertiesOfType } from '../utils';

const functionLikeSymbol = ts.SymbolFlags.Function | ts.SymbolFlags.Method;
const signatureFormatFlags = ts.TypeFormatFlags.UseFullyQualifiedType | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            // TODO maybe check Type["property"]
            if (isIdentifier(node)) {
                if (shouldCheckIdentifier(node))
                    this.checkSymbol(this.checker.getSymbolAtLocation(node), node, node.text);
            } else if (isPropertyAccessExpression(node)) {
                this.checkSymbol(this.checker.getSymbolAtLocation(node), node, node.name.text);
            } else if (isElementAccessExpression(node)) {
                this.checkElementAccess(node);
            } else if (isPropertyAssignment(node)) {
                if (isReassignmentTarget(node.parent))
                    this.checkObjectDestructuring(node);
            } else if (isShorthandPropertyAssignment(node)) {
                this.checkSymbol(this.checker.getShorthandAssignmentValueSymbol(node), node, node.name.text);
                if (isReassignmentTarget(node.parent))
                    this.checkObjectDestructuring(node);
            } else if (isCallLikeExpression(node)) {
                this.checkSignature(node);
            } else if (isObjectBindingPattern(node)) {
                this.checkObjectBindingPattern(node);
            } else if (node.kind === ts.SyntaxKind.QualifiedName && shouldCheckQualifiedName(node)) {
                this.checkSymbol(this.checker.getSymbolAtLocation(node), node, node.right.text);
            }
        }
    }

    private checkObjectDestructuring(node: ts.PropertyAssignment | ts.ShorthandPropertyAssignment) {
        const type = this.checker.getTypeOfAssignmentPattern(node.parent!);
        for (const {symbolName, displayName} of getLateBoundPropertyNamesOfPropertyName(node.name, this.checker).names) {
            const symbol = getPropertyOfType(type, symbolName);
            if (symbol !== undefined)
                this.checkStability(symbol, node.name, displayName, describeWithName);
        }
    }

    private checkSignature(node: ts.CallLikeExpression) {
        return this.checkStability(this.checker.getResolvedSignature(node)!, node, undefined, signatureToString);
    }

    private checkObjectBindingPattern(node: ts.ObjectBindingPattern) {
        const type = this.checker.getTypeAtLocation(node)!;
        for (const element of node.elements) {
            if (element.dotDotDotToken !== undefined)
                continue;
            if (element.propertyName === undefined) {
                const name = (<ts.Identifier>element.name).text;
                const symbol = type.getProperty(name);
                if (symbol !== undefined)
                    this.checkStability(symbol, element.name, name, describeWithName);
            } else {
                const propName = getPropertyName(element.propertyName);
                if (propName !== undefined) {
                    const symbol = type.getProperty(propName);
                    if (symbol !== undefined)
                        this.checkStability(symbol, element.propertyName, propName, describeWithName);
                } else {
                    for (const {symbol, name} of propertiesOfType(
                            type,
                            getLateBoundPropertyNames((<ts.ComputedPropertyName>element.propertyName).expression!, this.checker).names,
                        )
                    )
                        this.checkStability(symbol, element.propertyName, name, describeWithName);
                }
            }
        }
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        for (const {symbol, name} of elementAccessSymbols(node, this.checker))
            this.checkSymbol(symbol, node, name);
    }

    private checkSymbol(symbol: ts.Symbol | undefined, node: ts.Node, name: string) {
        if (symbol === undefined)
            return;
        if (symbol.flags & ts.SymbolFlags.Alias)
            symbol = this.checker.getAliasedSymbol(symbol);
        if ((symbol.flags & functionLikeSymbol) && isPartOfCall(node))
            return;
        return this.checkStability(symbol, node, name, describeWithName);
    }

    private checkStability<T extends ts.Signature | ts.Symbol, U extends ts.Node, V>(
        s: T,
        node: U,
        hint: V,
        descr: (s: T, checker: ts.TypeChecker, hint: V, node: U) => string,
    ) {
        for (const tag of s.getJsDocTags())
            if (tag.name === 'deprecated' || tag.name === 'experimental')
                this.addFindingAtNode(
                    node,
                    `${descr(s, this.checker, hint, node)} is ${tag.name}${tag.text ? ': ' + tag.text : '.'}`,
                );
    }
}

function describeWithName(symbol: ts.Symbol, _c: ts.TypeChecker, name: string) {
    return `${describeSymbol(symbol)} '${name}'`;
}

function describeSymbol(symbol: ts.Symbol): string {
    if (symbol.flags & ts.SymbolFlags.Variable)
        return 'Variable';
    if (symbol.flags & ts.SymbolFlags.PropertyOrAccessor)
        return 'Property';
    if (symbol.flags & ts.SymbolFlags.Class)
        return 'Class';
    if (symbol.flags & ts.SymbolFlags.Enum)
        return 'Enum';
    if (symbol.flags & ts.SymbolFlags.EnumMember)
        return 'EnumMember';
    if (symbol.flags & ts.SymbolFlags.Function)
        return 'Function';
    if (symbol.flags & ts.SymbolFlags.Method)
        return 'Method';
    if (symbol.flags & ts.SymbolFlags.Interface)
        return 'Interface';
    if (symbol.flags & ts.SymbolFlags.NamespaceModule)
        return 'Namespace';
    if (symbol.flags & ts.SymbolFlags.TypeAlias)
        return 'TypeAlias';
    return '(unknown)';
}

function signatureToString(signature: ts.Signature, checker: ts.TypeChecker, _: undefined, node: ts.CallLikeExpression) {
    let construct = false;
    switch (signature.declaration && signature.declaration.kind) {
        case ts.SyntaxKind.Constructor:
        case ts.SyntaxKind.ConstructSignature:
        case ts.SyntaxKind.ConstructorType:
            construct = true;
    }
    let name = '';
    const expr = getExpressionOfCallLike(node);
    if (isIdentifier(expr)) {
        name = expr.text;
    } else if (isPropertyAccessExpression(expr)) {
        name = expr.name.text;
    } else if (expr.kind === ts.SyntaxKind.SuperKeyword) {
        name = 'super';
    }
    return `${construct ? 'Costruct' : 'Call'}Signature '${
        construct && expr.kind !== ts.SyntaxKind.SuperKeyword ? 'new ' : ''
    }${name}${checker.signatureToString(signature, undefined, signatureFormatFlags)}'`;
}

function getExpressionOfCallLike(node: ts.CallLikeExpression): ts.Expression {
    switch (node.kind) {
        case ts.SyntaxKind.CallExpression:
        case ts.SyntaxKind.NewExpression:
        case ts.SyntaxKind.Decorator:
            return (<ts.CallExpression | ts.NewExpression | ts.Decorator>node).expression;
        case ts.SyntaxKind.TaggedTemplateExpression:
            return (<ts.TaggedTemplateExpression>node).tag;
        case ts.SyntaxKind.JsxOpeningElement:
        case ts.SyntaxKind.JsxSelfClosingElement:
            return (<ts.JsxOpeningLikeElement>node).tagName;
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
        case ts.SyntaxKind.JsxClosingElement:
            return false;
        case ts.SyntaxKind.ShorthandPropertyAssignment: // checked separately
            return (<ts.ShorthandPropertyAssignment>node.parent).name !== node;
        default:
            return getUsageDomain(node) !== undefined;
    }
}

function shouldCheckQualifiedName(node: ts.Node): node is ts.QualifiedName {
    // if parent is a QualifiedName, it is the my.ns part of my.ns.Something -> we definitely want to check that
    // if the parent is an ImportEqualsDeclaration -> we don't want to check the rightmost identifier, because importing is not that bad
    // everything else is a TypeReference -> we want to check that
    return node.parent!.kind !== ts.SyntaxKind.ImportEqualsDeclaration;
}
