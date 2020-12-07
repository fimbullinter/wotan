import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { propertiesOfType } from '../utils';
import {
    isThisParameter,
    isTypeParameter,
    isTypeReference,
    isIntersectionType,
    isFunctionScopeBoundary,
    isMethodDeclaration,
    hasModifier,
    getLateBoundPropertyNames,
    getConstructorTypeOfClassLikeDeclaration,
} from 'tsutils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.ElementAccessExpression)
                this.checkElementAccess(<ts.ElementAccessExpression>node);
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        const {names} = getLateBoundPropertyNames(node.argumentExpression, this.checker);
        if (names.length === 0)
            return;
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node.expression));
        for (const {symbol, name} of propertiesOfType(type, names))
            this.checkSymbol(symbol, name, node, node.expression, type);
    }

    private checkSymbol(symbol: ts.Symbol, name: string, errorNode: ts.Node, lhs: ts.Expression, lhsType: ts.Type) {
        const flags = getModifierFlagsOfSymbol(symbol);

        if (
            lhs !== undefined && lhs.kind === ts.SyntaxKind.ThisKeyword &&
            flags & ts.ModifierFlags.Abstract && hasNonMethodDeclaration(symbol)
        ) {
            const enclosingClass = getEnclosingClassOfAbstractPropertyAccess(errorNode.parent!);
            if (enclosingClass !== undefined)
                return this.addFindingAtNode(
                    errorNode,
                    `Abstract property '${name}' in class '${
                        this.printClass(enclosingClass)
                    }' cannot be accessed during class initialization.`,
                );
        }
        if (lhs !== undefined && lhs.kind === ts.SyntaxKind.SuperKeyword) {
            if (hasNonMethodDeclaration(symbol))
                return this.addFindingAtNode(
                    errorNode,
                    "Only public and protected methods of the base class are accessible via the 'super' keyword.",
                );
            if (
                flags & ts.ModifierFlags.Abstract &&
                symbol.declarations!.every((d) => hasModifier(d.modifiers, ts.SyntaxKind.AbstractKeyword))
            )
                return this.addFindingAtNode(
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
                return this.addFindingAtNode(
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
        this.addFindingAtNode(
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
                    const declaredType = getConstructorTypeOfClassLikeDeclaration(<ts.ClassLikeDeclaration>node, this.checker);
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
        return this.checker.typeToString(getConstructorTypeOfClassLikeDeclaration(declaration, this.checker));
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
