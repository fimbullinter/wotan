import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    NodeWrap,
    isTypeNodeKind,
    isExpression,
    isIdentifier,
    getUsageDomain,
    unionTypeParts,
    isThenableType,
    isMethodDeclaration,
    isPropertyDeclaration,
    getPropertyName,
    isValidNumericLiteral,
    removeOptionalityFromType,
    isArrowFunction,
    getModifier,
    isFunctionExpression,
    getChildOfKind,
} from 'tsutils';
import { getPropertyOfType, lateBoundPropertyNames, LateBoundPropertyName } from '../utils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        this.context.getWrappedAst().children.forEach(this.checkNode, this);
    }

    private checkNode({node, children}: NodeWrap) {
        if (isTypeNodeKind(node.kind))
            return;

        if (isExpression(node)) {
            if (!isIdentifier(node) || getUsageDomain(node) !== undefined)
                this.checkAssignment(node);
        } else if (isPropertyDeclaration(node)) {
            this.checkClassProperty(node, node.parent!);
        } else if (isMethodDeclaration(node)) {
            const parent = node.parent!;
            if (parent.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                this.checkObjectMethodDeclaration(node, parent);
            } else {
                this.checkClassProperty(node, parent);
            }
        }
        return children.forEach(this.checkNode, this);
    }

    private checkAssignment(node: ts.Expression) {
        if (
            returnTypeMatches(this.checker.getContextualType(node), this.checker, isVoidType) &&
            returnTypeMatches(this.checker.getTypeAtLocation(node), this.checker, typeContainsThenable, node)
        ) {
            let errorNode: ts.Node = node;
            if (isArrowFunction(node)) {
                errorNode = getModifier(node, ts.SyntaxKind.AsyncKeyword) || node.equalsGreaterThanToken;
            } else if (isFunctionExpression(node)) {
                errorNode = getModifier(node, ts.SyntaxKind.AsyncKeyword) ||
                    node.name ||
                    getChildOfKind(node, ts.SyntaxKind.FunctionKeyword)!;
            }
            this.addFindingAtNode(errorNode, "A 'Promise'-returning function should not be assigned to a 'void'-returning function type.");
        }
    }

    private checkClassProperty(node: ts.PropertyDeclaration | ts.MethodDeclaration, clazz: ts.ClassLikeDeclaration) {
        if (clazz.heritageClauses === undefined)
            return;
        const checker = this.checker;
        if (node.kind === ts.SyntaxKind.MethodDeclaration) {
            const signature = checker.getSignatureFromDeclaration(node);
            if (signature === undefined || !typeContainsThenable(signature.getReturnType(), checker, clazz))
                return;
        } else if (!returnTypeMatches(checker.getTypeAtLocation(node), checker, typeContainsThenable, clazz)) {
            return;
        }
        const staticName = getPropertyName(node.name);
        const properties: LateBoundPropertyName[] = staticName !== undefined
            ? [{name: staticName, symbolName: ts.escapeLeadingUnderscores(staticName)}]
            : lateBoundPropertyNames((<ts.ComputedPropertyName>node.name).expression, checker).properties;
        for (const {name, symbolName} of properties)
            for (const heritageClause of clazz.heritageClauses)
                for (const base of heritageClause.types)
                    if (returnTypeMatches(this.getTypeOfProperty(checker.getTypeAtLocation(base), symbolName, base), checker, isVoidType))
                        return this.addFindingAtNode(
                            getModifier(node, ts.SyntaxKind.AsyncKeyword) || node.name,
                            `Overriding 'void'-returning method '${name}' of base type with a 'Promise'-returning method is unsafe.`,
                        );
    }

    private getTypeOfProperty(classType: ts.Type, name: ts.__String, node: ts.Node) {
        const propertySymbol = getPropertyOfType(classType, name);
        return propertySymbol && this.checker.getTypeOfSymbolAtLocation(propertySymbol, node);
    }

    private checkObjectMethodDeclaration(node: ts.MethodDeclaration, parent: ts.ObjectLiteralExpression) {
        const staticName = getPropertyName(node.name);
        const contextualType = this.checker.getContextualType(parent);
        if (contextualType === undefined)
            return;
        const properties: LateBoundPropertyName[] = staticName !== undefined
            ? [{name: staticName, symbolName: ts.escapeLeadingUnderscores(staticName)}]
            : lateBoundPropertyNames((<ts.ComputedPropertyName>node.name).expression, this.checker).properties;
        for (const {name, symbolName} of properties) {
            const property = getPropertyOfType(contextualType, symbolName);
            const propertyType = property
                ? this.checker.getTypeOfSymbolAtLocation(property, parent)
                : isValidNumericLiteral(name) && String(+name) === name && contextualType.getNumberIndexType() ||
                    contextualType.getStringIndexType();
            if (!returnTypeMatches(propertyType, this.checker, isVoidType))
                continue;
            const signature = this.checker.getSignatureFromDeclaration(node);
            if (signature !== undefined && typeContainsThenable(signature.getReturnType(), this.checker, node))
                return this.addFindingAtNode(
                    getModifier(node, ts.SyntaxKind.AsyncKeyword) || node.name,
                    `'Promise'-returning method '${name}' should not be assigned to a 'void'-returning function type.`,
                );
        }
    }
}

function returnTypeMatches<T>(
    type: ts.Type | undefined,
    checker: ts.TypeChecker,
    predicate: (type: ts.Type, checker: ts.TypeChecker, param: T) => boolean,
    param: T,
): boolean;
function returnTypeMatches(
    type: ts.Type | undefined,
    checker: ts.TypeChecker,
    predicate: (type: ts.Type, checker: ts.TypeChecker) => boolean,
): boolean;
function returnTypeMatches(
    type: ts.Type | undefined,
    checker: ts.TypeChecker,
    predicate: (type: ts.Type, checker: ts.TypeChecker, param?: unknown) => boolean,
    param?: unknown,
) {
    if (type === undefined)
        return false;
    const callSignatures = removeOptionalityFromType(checker, type).getCallSignatures();
    return callSignatures.length !== 0 && callSignatures.every((signature) => predicate(signature.getReturnType(), checker, param));
}

function typeContainsThenable(type: ts.Type, checker: ts.TypeChecker, node: ts.Node): boolean {
    return unionTypeParts(type).some((t) => isThenableType(checker, node, t));
}

function isVoidType(type: ts.Type) {
    return (type.flags & ts.TypeFlags.Void) !== 0;
}
