import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { propertiesOfType } from '../utils';
import {
    isThisParameter,
    isTypeParameter,
    isTypeReference,
    isIntersectionType,
    isFunctionScopeBoundary,
    hasModifier,
    getLateBoundPropertyNames,
    getInstanceTypeOfClassLikeDeclaration,
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
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node.expression)).getNonNullableType();
        for (const {symbol, name} of propertiesOfType(type, names))
            this.checkSymbol(symbol, name, node, type);
    }

    private checkSymbol(symbol: ts.Symbol, name: string, node: ts.ElementAccessExpression, lhsType: ts.Type) {
        const flags = getModifierFlagsOfSymbol(symbol);

        if (
            node.expression.kind === ts.SyntaxKind.ThisKeyword &&
            flags & ts.ModifierFlags.Abstract && hasNonPrototypeDeclaration(symbol)
        ) {
            const enclosingClass = getEnclosingClassOfAbstractPropertyAccess(node.parent!);
            if (enclosingClass !== undefined)
                return this.addFindingAtNode(
                    node,
                    `Abstract property '${name}' in class '${
                        this.printClass(enclosingClass)
                    }' cannot be accessed during class initialization.`,
                );
        }
        if (node.expression.kind === ts.SyntaxKind.SuperKeyword && (flags & ts.ModifierFlags.Static) === 0 && !isStaticSuper(node)) {
            if (hasNonPrototypeDeclaration(symbol))
                return this.addFindingAtNode(
                    node,
                    "Only public and protected methods and accessors of the base class are accessible via the 'super' keyword.",
                );
            if (
                flags & ts.ModifierFlags.Abstract &&
                symbol.declarations!.every((d) => hasModifier(d.modifiers, ts.SyntaxKind.AbstractKeyword))
            )
                return this.addFindingAtNode(
                    node,
                    `Abstract member '${name}' in class '${
                        this.printClass(<ts.ClassLikeDeclaration>symbol.declarations![0].parent)
                    }' cannot be accessed via the 'super' keyword.`,
                );
        }

        if ((flags & ts.ModifierFlags.NonPublicAccessibilityModifier) === 0)
            return;
        if (flags & ts.ModifierFlags.Private) {
            const declaringClass = <ts.ClassLikeDeclaration>symbol.declarations![0].parent;
            if (node.pos < declaringClass.pos || node.end > declaringClass.end)
                this.failVisibility(node, name, this.printClass(declaringClass), true);
        } else {
            const declaringClasses = symbol.declarations!.map((d) => <ts.ClassLikeDeclaration>d.parent);
            let enclosingClass = this.findEnclosingClass(node.parent!, declaringClasses);
            if (enclosingClass === undefined) {
                if ((flags & ts.ModifierFlags.Static) === 0)
                    enclosingClass = this.getEnclosingClassFromThisParameter(node.parent!, declaringClasses);
                if (enclosingClass === undefined)
                    return this.failVisibility(node, name, this.checker.typeToString(lhsType), false);
            }
            if ((flags & ts.ModifierFlags.Static) === 0 && !hasBase(lhsType, enclosingClass, isIdentical))
                return this.addFindingAtNode(
                    node,
                    `Property '${name}' is protected and only accessible through an instance of class '${
                        this.checker.typeToString(enclosingClass)
                    }'.`,
                );
        }
    }

    private getEnclosingClassFromThisParameter(node: ts.Node, baseClasses: ts.ClassLikeDeclaration[]) {
        const thisParameter = getThisParameterFromContext(node);
        if (thisParameter?.type === undefined)
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
                    const declaredType = getInstanceTypeOfClassLikeDeclaration(<ts.ClassLikeDeclaration>node, this.checker);
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
        return this.checker.typeToString(getInstanceTypeOfClassLikeDeclaration(declaration, this.checker));
    }
}

function isStaticSuper(node: ts.Node) {
    while (true) {
        switch (node.kind) {
            // super in computed property names, heritage clauses and decorators refers to 'this' outside of the current class
            case ts.SyntaxKind.ComputedPropertyName:
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                node = node.parent!.parent!.parent!;
                break;
            case ts.SyntaxKind.Decorator:
                switch (node.parent!.kind) {
                    case ts.SyntaxKind.ClassDeclaration:
                    case ts.SyntaxKind.ClassExpression:
                        node = node.parent.parent!;
                        break;
                    case ts.SyntaxKind.Parameter:
                        node = node.parent.parent!.parent!.parent!;
                        break;
                    default: // class element decorator
                        node = node.parent.parent!.parent!;
                }
                break;
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                return hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword);
            case ts.SyntaxKind.Constructor:
                return false;
            default:
                node = node.parent!;
        }
    }
}

function hasNonPrototypeDeclaration(symbol: ts.Symbol) {
    for (const {kind} of symbol.declarations!) {
        switch (kind) {
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                continue;
        }
        return true;
    }
    return false;
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
        if (t.getBaseTypes()?.some(recur))
            return true;
        return isIntersectionType(t) && t.types.some(recur);
    })(type);
}

function isIdentical<T>(a: T, b: T) {
    return a === b;
}

function typeContainsDeclaration(type: ts.Type, declaration: ts.Declaration) {
    return type.symbol!.declarations!.includes(declaration);
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
            // this in computed property names, heritage clauses and decorators refers to 'super' outside of the current class
            case ts.SyntaxKind.ComputedPropertyName:
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                node = node.parent!.parent!.parent!;
                break;
            case ts.SyntaxKind.Decorator:
                switch (node.parent!.kind) {
                    case ts.SyntaxKind.ClassDeclaration:
                    case ts.SyntaxKind.ClassExpression:
                        node = node.parent.parent!;
                        break;
                    case ts.SyntaxKind.Parameter:
                        node = node.parent.parent!.parent!.parent!;
                        break;
                    default: // class element decorator
                        node = node.parent.parent!.parent!;
                }
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
