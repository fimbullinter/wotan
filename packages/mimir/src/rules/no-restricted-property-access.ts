import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { lateBoundPropertyNames, propertiesOfType } from '../utils';
import {
    isThisParameter,
    isTypeParameter,
    isTypeReference,
    isIntersectionType,
    isFunctionScopeBoundary,
    isMethodDeclaration,
    hasModifier,
 } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.ElementAccessExpression:
                    this.checkElementAccess(<ts.ElementAccessExpression>node);
                    break;
                case ts.SyntaxKind.ComputedPropertyName:
                    switch (node.parent!.kind) {
                        case ts.SyntaxKind.PropertyAssignment:
                            break; // TODO https://github.com/Microsoft/TypeScript/issues/26509
                        case ts.SyntaxKind.BindingElement:
                            this.checkComputedProperty(<ts.ComputedPropertyName>node);
                    }
            }
        }
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        // for compatibility with typescript@<2.9.0
        if (node.argumentExpression === undefined || node.argumentExpression.pos === node.argumentExpression.end)
            return;
        this.checkPropertiesOfNode(node.expression, node.argumentExpression, node, node.expression);
    }

    private checkComputedProperty(node: ts.ComputedPropertyName) {
        // TODO could use some magic to find the initializer of the destructuring
        this.checkPropertiesOfNode(node.parent!.parent!, node.expression, node, undefined);
    }

    private checkPropertiesOfNode(parent: ts.Node, propertyName: ts.Expression, errorNode: ts.Node, lhs: ts.Expression | undefined) {
        const {properties} = lateBoundPropertyNames(propertyName, this.checker);
        if (properties.length === 0)
            return;
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(parent));
        for (const {symbol, name} of propertiesOfType(type, properties))
            this.checkSymbol(symbol, name, errorNode, lhs, type);
    }

    private checkSymbol(symbol: ts.Symbol, name: string, errorNode: ts.Node, lhs: ts.Expression | undefined, lhsType: ts.Type) {
        const flags = getModifierFlagsOfSymbol(symbol);

        if (hasConflictingAccessModifiers(flags, symbol))
            return this.addFailureAtNode(
                errorNode,
                `Property '${name}' has conflicting declarations and is inaccessible in type '${this.checker.typeToString(lhsType)}'.`,
            );

        if (
            lhs !== undefined && lhs.kind === ts.SyntaxKind.ThisKeyword &&
            flags & ts.ModifierFlags.Abstract && hasNonMethodDeclaration(symbol)
        ) {
            const enclosingClass = getEnclosingClassOfAbstractPropertyAccess(errorNode.parent!);
            if (enclosingClass !== undefined)
                return this.addFailureAtNode(
                    errorNode,
                    `Abstract property '${name}' in class '${
                        this.printClass(enclosingClass)
                    }' cannot be accessed during class initialization.`,
                );
        }
        if (lhs !== undefined && lhs.kind === ts.SyntaxKind.SuperKeyword) {
            if (hasNonMethodDeclaration(symbol))
                return this.addFailureAtNode(
                    errorNode,
                    "Only public and protected methods of the base class are accessible via the 'super' keyword.",
                );
            if (
                flags & ts.ModifierFlags.Abstract &&
                symbol.declarations!.every((d) => hasModifier(d.modifiers, ts.SyntaxKind.AbstractKeyword))
            )
                return this.addFailureAtNode(
                    errorNode,
                    `Abstract method '${name}' in class '${
                        this.printClass(<ts.ClassLikeDeclaration>symbol.declarations![0].parent)
                    }' cannot be accessed via the 'super' keyword.`,
                );
        }

        if ((flags & ts.ModifierFlags.NonPublicAccessibilityModifier) === 0)
            return;
        if (flags & ts.ModifierFlags.Private) {
            const declaringClass = <ts.ClassLikeDeclaration>symbol.declarations![0].parent;
            if (errorNode.pos < declaringClass.pos || errorNode.end > declaringClass.end)
                this.failVisibility(errorNode, name, this.printClass(declaringClass), true);
        } else {
            const declaringClasses = symbol.declarations!.map((d) => <ts.ClassLikeDeclaration>d.parent);
            let enclosingClass = this.findEnclosingClass(errorNode.parent!.parent!, declaringClasses);
            if (enclosingClass === undefined) {
                if ((flags & ts.ModifierFlags.Static) === 0)
                    enclosingClass = this.getEnclosingClassFromThisParameter(errorNode.parent!.parent!, declaringClasses);
                if (enclosingClass === undefined)
                    return this.failVisibility(errorNode, name, this.checker.typeToString(lhsType), false);
            }
            if ((flags & ts.ModifierFlags.Static) === 0 && !hasBase(lhsType, enclosingClass, isIdentical))
                return this.addFailureAtNode(
                    errorNode,
                    `Property '${name}' is protected and only accessible through an instance of class '${
                        this.checker.typeToString(enclosingClass)
                    }'.`,
                );
        }
    }

    private getEnclosingClassFromThisParameter(node: ts.Node, baseClasses: ts.ClassLikeDeclaration[]) {
        const thisParameter = getThisParameterFromContext(node);
        if (thisParameter === undefined || thisParameter.type === undefined)
            return;
        let thisType = this.checker.getTypeFromTypeNode(thisParameter.type);
        if (isTypeParameter(thisType)) {
            const constraint = thisType.getConstraint();
            if (constraint === undefined)
                return;
            thisType = constraint;
        }
        if (isTypeReference(thisType))
            thisType = thisType.target;
        return baseClasses.every((baseClass) => hasBase(thisType, baseClass, typeContainsDeclaration)) ? thisType : undefined;
    }

    private failVisibility(node: ts.Node, property: string, typeString: string, isPrivate: boolean) {
        this.addFailureAtNode(
            node,
            `Property '${property}' is ${isPrivate ? 'private' : 'protected'} and only accessible within class '${typeString}'${
                isPrivate ? '' : ' and its subclasses'
            }.`,
        );
    }

    private findEnclosingClass(node: ts.Node, baseClasses: ts.ClassLikeDeclaration[]) {
        while (true) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression: {
                    const declaredType = this.getDeclaredType(<ts.ClassLikeDeclaration>node);
                    if (baseClasses.every((baseClass) => hasBase(declaredType, baseClass, typeContainsDeclaration)))
                        return declaredType;
                    break;
                }
                case ts.SyntaxKind.SourceFile:
                    return;
            }
            node = node.parent!;
        }
    }

    private printClass(declaration: ts.ClassLikeDeclaration) {
        return this.checker.typeToString(this.getDeclaredType(declaration));
    }

    private getDeclaredType(declaration: ts.ClassLikeDeclaration) {
        return this.checker.getDeclaredTypeOfSymbol(
            declaration.name !== undefined
                ? this.checker.getSymbolAtLocation(declaration.name)!
                : this.checker.getTypeAtLocation(declaration).symbol!,
        );
    }
}

function hasNonMethodDeclaration(symbol: ts.Symbol) {
    return !symbol.declarations!.every(isMethodDeclaration);
}

function getEnclosingClassOfAbstractPropertyAccess(node: ts.Node) {
    while (true) {
        if (isFunctionScopeBoundary(node)) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                    return <ts.ClassLikeDeclaration>node;
                case ts.SyntaxKind.Constructor:
                    return <ts.ClassLikeDeclaration>node.parent;
                default:
                    return;
            }
        }
        node = node.parent!;
    }
}

function hasConflictingAccessModifiers(flags: ts.ModifierFlags, symbol: ts.Symbol) {
    return flags & ts.ModifierFlags.Private
        ? symbol.declarations!.length !== 1
        : (flags & ts.ModifierFlags.Protected) !== 0 &&
            symbol.declarations!.length !== 1 &&
            !symbol.declarations.every((d) => hasModifier(d.modifiers, ts.SyntaxKind.ProtectedKeyword));
}

function hasBase<T>(type: ts.Type, needle: T, check: (type: ts.Type, needle: T) => boolean) {
    return (function recur(t): boolean {
        if (isTypeReference(t)) {
            t = t.target;
            if (check(t, needle))
                return true;
        }
        const baseTypes = t.getBaseTypes();
        if (baseTypes !== undefined && baseTypes.some(recur))
            return true;
        return isIntersectionType(t) && t.types.some(recur);
    })(type);
}

function isIdentical<T>(a: T, b: T) {
    return a === b;
}

function typeContainsDeclaration(type: ts.Type, declaration: ts.Declaration) {
    return type.symbol !== undefined && type.symbol.declarations !== undefined && type.symbol.declarations.includes(declaration);
}

function getThisParameterFromContext(node: ts.Node) {
    while (true) {
        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.MethodDeclaration: {
                const {parameters} = <ts.FunctionLikeDeclaration>node;
                return parameters.length !== 0 && isThisParameter(parameters[0]) ? parameters[0] : undefined;
            }
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.SourceFile:
                return;
            case ts.SyntaxKind.Decorator:
                // skip the declaration the decorator belongs to, because decorators are always applied in the outer context
                node = node.parent!.parent!;
                break;
            default:
                node = node.parent!;
        }
    }
}

function getModifierFlagsOfSymbol(symbol: ts.Symbol): ts.ModifierFlags {
    return symbol.declarations === undefined
        ? ts.ModifierFlags.None
        : symbol.declarations.reduce((flags, decl) => flags | ts.getCombinedModifierFlags(decl), ts.ModifierFlags.None);

}
