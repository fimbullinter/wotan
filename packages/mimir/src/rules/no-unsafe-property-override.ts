import { TypedRule } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isPropertyDeclaration,
    isUnionOrIntersectionType,
    isInConstContext,
    isObjectFlagSet,
    isObjectType,
    isTypeReference,
    isTupleType,
    isPropertyAccessExpression,
    isIdentifier,
    isEntityNameExpression,
    isPropertyAssignment,
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
    return symbol.declarations !== undefined && containsReadonlyPropertyDeclaration(symbol.declarations, checker) ||
        (symbol.flags & ts.SymbolFlags.Transient) !== 0 && (
            /^(?:[1-9]\d*|0)$/.test(symbol.name) && distributeCheck(parentType, symbol.escapedName, isElementOfReadonlyTuple) ||
            distributeCheck(parentType, symbol.escapedName, isReadonlyPropertyFromMappedType)
        );
        // TODO readonly index signature
}

function containsReadonlyPropertyDeclaration(declarations: ReadonlyArray<ts.Declaration>, checker: ts.TypeChecker) {
    for (const node of declarations) {
        if (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Readonly)
            return true;
        switch (node.kind) {
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                if (isInConstContext(<ts.ObjectLiteralExpression>node.parent))
                    return true;
                break;
            case ts.SyntaxKind.CallExpression:
                if (isReadonlyAssignmentDeclaration(<ts.CallExpression>node, checker))
                    return true;
        }
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
        (<{intrinsicName: string}><{}>writableType).intrinsicName === 'false';

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

function distributeCheck(type: ts.Type, name: ts.__String, cb: (type: ts.Type, name: ts.__String) => boolean) {
    if (isUnionOrIntersectionType(type)) {
        for (const t of type.types)
            if (distributeCheck(t, name, cb))
                return true;
        return false;
    }

    return cb(type, name);
}

function isElementOfReadonlyTuple(type: ts.Type, name: ts.__String): boolean {
    return isTypeReference(type) && isTupleType(type.target) && type.target.readonly && getPropertyOfType(type.target, name) !== undefined;
}

function isReadonlyPropertyFromMappedType(type: ts.Type, name: ts.__String): boolean {
    if (!isObjectType(type) || !isObjectFlagSet(type, ts.ObjectFlags.Mapped))
        return false;
    const declaration = <ts.MappedTypeNode>type.symbol!.declarations![0];
    if (declaration.readonlyToken !== undefined)
        return declaration.readonlyToken.kind !== ts.SyntaxKind.MinusToken;
    return distributeCheck((<{modifiersType: ts.Type}><unknown>type).modifiersType, name, isReadonlyPropertyFromMappedType);
}
