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
import { getPropertyOfType } from '../utils';

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
            returnTypeMatches(this.checker.getContextualType(node), isVoidType) &&
            returnTypeMatches(this.checker.getTypeAtLocation(node), typeContainsThenable, this.checker, node)
        ) {
            let errorNode: ts.Node = node;
            if (isArrowFunction(node)) {
                errorNode = getModifier(node, ts.SyntaxKind.AsyncKeyword) || node.equalsGreaterThanToken;
            } else if (isFunctionExpression(node)) {
                errorNode = getModifier(node, ts.SyntaxKind.AsyncKeyword) ||
                    node.name ||
                    getChildOfKind(node, ts.SyntaxKind.FunctionKeyword)!;
            }
            this.addFailureAtNode(errorNode, "A 'Promise'-returning function should not be assigned to a 'void'-returning function type.");
        }
    }

    private checkClassProperty(node: ts.PropertyDeclaration | ts.MethodDeclaration, clazz: ts.ClassLikeDeclaration) {
        const {heritageClauses} = clazz;
        if (heritageClauses === undefined)
            return;
        const staticName = getPropertyName(node.name);
        if (staticName === undefined)
            return; // TODO handle computed names
        let classType = this.checker.getTypeAtLocation(clazz);
        if (clazz.kind === ts.SyntaxKind.ClassExpression)
            // get the instance type instead of the constructor type
            classType = this.checker.getTypeOfSymbolAtLocation(classType.getProperty('prototype')!, clazz);
        if (!returnTypeMatches(this.getTypeOfProperty(classType, staticName, clazz), typeContainsThenable, this.checker, clazz))
            return;
        for (const heritageClause of heritageClauses)
            for (const base of heritageClause.types)
                if (returnTypeMatches(this.getTypeOfProperty(this.checker.getTypeAtLocation(base), staticName, base), isVoidType))
                    return this.addFailureAtNode(
                        getModifier(node, ts.SyntaxKind.AsyncKeyword) || node.name,
                        `Overriding 'void'-returning method in base type with a 'Promise'-returning method is unsafe.`,
                    );
    }

    private getTypeOfProperty(classType: ts.Type, name: string, node: ts.Node) {
        const propertySymbol = getPropertyOfType(classType, ts.escapeLeadingUnderscores(name));
        return propertySymbol && this.checker.getTypeOfSymbolAtLocation(propertySymbol, node);
    }

    private checkObjectMethodDeclaration(node: ts.MethodDeclaration, parent: ts.ObjectLiteralExpression) {
        const staticName = getPropertyName(node.name);
        if (staticName === undefined)
            return; // TODO handle late bound names
        const contextualType = this.checker.getContextualType(parent);
        if (contextualType === undefined)
            return;
        const property = getPropertyOfType(contextualType, ts.escapeLeadingUnderscores(staticName));
        const propertyType = property
            ? this.checker.getTypeOfSymbolAtLocation(property, parent)
            : isValidNumericLiteral(staticName) && String(+staticName) === staticName && contextualType.getNumberIndexType() ||
                contextualType.getStringIndexType();
        if (!returnTypeMatches(propertyType && removeOptionalityFromType(this.checker, propertyType), isVoidType))
            return;
        const signature = this.checker.getSignatureFromDeclaration(node);
        if (signature !== undefined && typeContainsThenable(signature.getReturnType(), this.checker, node))
            this.addFailureAtNode(
                getModifier(node, ts.SyntaxKind.AsyncKeyword) || node.name,
                "A 'Promise'-returning function should not be assigned to a 'void'-returning function type.",
            );
    }
}

function returnTypeMatches<T extends Array<unknown>>(
    type: ts.Type | undefined,
    predicate: (type: ts.Type, ...args: T) => boolean,
    ...args: T
) {
    if (type === undefined)
        return false;
    const callSignatures = type.getCallSignatures();
    return callSignatures.length !== 0 && callSignatures.every((signature) => predicate(signature.getReturnType(), ...args));
}

function typeContainsThenable(type: ts.Type, checker: ts.TypeChecker, node: ts.Node): boolean {
    return unionTypeParts(type).some((t) => isThenableType(checker, node, t));
}

function isVoidType(type: ts.Type) {
    return (type.flags & ts.TypeFlags.Void) !== 0;
}
