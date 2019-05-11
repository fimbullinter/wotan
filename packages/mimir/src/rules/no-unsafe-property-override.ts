import { TypedRule } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isPropertyDeclaration,
    isInConstContext,
    isObjectFlagSet,
    isObjectType,
    isTypeReference,
    isTupleType,
    isPropertyAccessExpression,
    isIdentifier,
    isEntityNameExpression,
    isPropertyAssignment,
    unionTypeParts,
    isSymbolFlagSet,
    isIntersectionType,
    isCallExpression,
    isShorthandPropertyAssignment,
    isVariableDeclaration,
} from 'tsutils';
import * as ts from 'typescript';
import { getPropertyOfType } from '../utils';

export class Rule extends TypedRule {
    public apply() {
        debugger;
        const re = /\bextends\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (
                !ts.isHeritageClause(node) ||
                node.token !== ts.SyntaxKind.ExtendsKeyword ||
                node.types.length === 0 ||
                node.types.pos !== re.lastIndex ||
                node.parent!.kind === ts.SyntaxKind.InterfaceDeclaration
            )
                continue;
            let baseType: ts.Type | undefined;
            for (const member of node.parent!.members) {
                if (!isPropertyDeclaration(member))
                    continue;
                const symbol = this.checker.getSymbolAtLocation(member.name);
                if (symbol === undefined)
                    continue;
                if (baseType === undefined)
                    baseType = this.checker.getTypeAtLocation(node.types[0]);
                const parentProperty = getPropertyOfType(baseType, symbol.escapedName);
                if (parentProperty === undefined || !isReadonlySymbol(parentProperty, baseType, this.checker))
                    continue;
                this.addFindingAtNode(
                    member.name,
                    `Overriding readonly property '${member.name.getText(this.sourceFile)}' might fail at runtime.`,
                );
            }
        }
    }
}

function isReadonlySymbol(symbol: ts.Symbol, parentType: ts.Type, checker: ts.TypeChecker) {
    if (symbol.flags & ts.SymbolFlags.GetAccessor)
        return (symbol.flags & ts.SymbolFlags.SetAccessor) === 0;
    return isReadonlyPropertyUnion(parentType, symbol.escapedName, checker);
}

function containsReadonlyPropertyDeclaration(declarations: ReadonlyArray<ts.Declaration>, checker: ts.TypeChecker) {
    for (const node of declarations)
        if (
            ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Readonly ||
            isVariableDeclaration(node) && node.parent!.flags & ts.NodeFlags.Const ||
            isCallExpression(node) && isReadonlyAssignmentDeclaration(node, checker) ||
            (isPropertyAssignment(node) || isShorthandPropertyAssignment(node)) && isInConstContext(node.parent!)
        )
            return true;
    return false;
}

function isReadonlyPropertyUnion(type: ts.Type, name: ts.__String, checker: ts.TypeChecker) {
    for (const t of unionTypeParts(type)) {
        if (getPropertyOfType(t, name) === undefined) {
            // property is not present in this part of the union -> check for readonly index signature
            const index = (String(+name) === name ? checker.getIndexInfoOfType(t, ts.IndexKind.Number) : undefined) ||
                checker.getIndexInfoOfType(t, ts.IndexKind.String);
            if (index !== undefined && index.isReadonly)
                return true;
        } else if (isReadonlyPropertyIntersection(t, name, checker)) {
            return true;
        }
    }
    return false;
}

function isReadonlyPropertyIntersection(type: ts.Type, name: ts.__String, checker: ts.TypeChecker) {
    for (const t of isIntersectionType(type) ? type.types : [type]) { // TODO intersectionTypeParts
        const prop = getPropertyOfType(t, name);
        if (prop === undefined)
            continue;
        if (isSymbolFlagSet(prop, ts.SymbolFlags.Transient)) {
            if (/^(?:[1-9]\d*|0)$/.test(<string>name) && isElementOfReadonlyTuple(t, name))
                return true;
            switch (isReadonlyPropertyFromMappedType(t, name, checker)) {
                case true:
                    return true;
                case false:
                    continue;
            }
        }
        // members of namespace import
        if (isSymbolFlagSet(prop, ts.SymbolFlags.ValueModule))
            return true;
        if (prop.declarations !== undefined && containsReadonlyPropertyDeclaration(prop.declarations, checker))
            return true;
    }
    return false;
}

function isReadonlyAssignmentDeclaration(node: ts.CallExpression, checker: ts.TypeChecker) {
    if (!isBindableObjectDefinePropertyCall(node))
        return false;
    const descriptorType = checker.getTypeAtLocation(node.arguments[2]);
    if (descriptorType.getProperty('value') === undefined)
        return descriptorType.getProperty('set') === undefined;
    const writableProp = descriptorType.getProperty('writable');
    if (writableProp === undefined)
        return false;
    const writableType = writableProp.valueDeclaration !== undefined && isPropertyAssignment(writableProp.valueDeclaration)
        ? checker.getTypeAtLocation(writableProp.valueDeclaration.initializer)
        : checker.getTypeOfSymbolAtLocation(writableProp, node.arguments[2]);
    return (writableType.flags & ts.TypeFlags.BooleanLiteral) !== 0 &&
        (<{intrinsicName: string}><{}>writableType).intrinsicName === 'false'; // move to tsutils

}

function isBindableObjectDefinePropertyCall(node: ts.CallExpression) {
    return node.arguments.length === 3 &&
        isEntityNameExpression(node.arguments[0]) &&
        isNumericOrStringLikeLiteral(node.arguments[1]) &&
        isPropertyAccessExpression(node.expression) &&
        node.expression.name.escapedText === 'defineProperty' &&
        isIdentifier(node.expression.expression) &&
        node.expression.expression.escapedText === 'Object';
}

function isNumericOrStringLikeLiteral(node: ts.Expression) {
    switch (node.kind) {
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.NumericLiteral:
        case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
            return true;
        default:
            return false;
    }
}

function isElementOfReadonlyTuple(type: ts.Type, name: ts.__String): boolean {
    return isTypeReference(type) && isTupleType(type.target) && type.target.readonly && getPropertyOfType(type.target, name) !== undefined;
}

function isReadonlyPropertyFromMappedType(type: ts.Type, name: ts.__String, checker: ts.TypeChecker): boolean | undefined {
    if (!isObjectType(type) || !isObjectFlagSet(type, ts.ObjectFlags.Mapped))
        return;
    const declaration = <ts.MappedTypeNode>type.symbol!.declarations![0];
    if (declaration.readonlyToken !== undefined)
        return declaration.readonlyToken.kind !== ts.SyntaxKind.MinusToken;
    return isReadonlyPropertyUnion((<{modifiersType: ts.Type}><unknown>type).modifiersType, name, checker);
}
