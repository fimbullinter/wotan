import * as ts from 'typescript';
import {
    AccessKind,
    getAccessKind,
    getBaseClassMemberOfClassElement,
    getInstanceTypeOfClassLikeDeclaration,
    hasModifier,
    isCompilerOptionEnabled,
    isFunctionScopeBoundary,
    isIntersectionType,
    isParameterDeclaration,
    isThisParameter,
    isTypeParameter,
    isTypeReference,
} from 'tsutils';

export function getRestrictedElementAccessError(
    checker: ts.TypeChecker,
    symbol: ts.Symbol,
    name: string,
    node: ts.ElementAccessExpression,
    lhsType: ts.Type,
    compilerOptions: ts.CompilerOptions,
): string | undefined {
    const flags = getModifierFlagsOfSymbol(symbol);

    if (node.expression.kind === ts.SyntaxKind.ThisKeyword && hasNonPrototypeDeclaration(symbol)) {
        const useDuringClassInitialization = getPropertyDeclarationOrConstructorAccessingProperty(node.parent!);
        if (useDuringClassInitialization !== undefined) {
            if (flags & ts.ModifierFlags.Abstract)
                return `Abstract property '${name}' in class '${printClass(useDuringClassInitialization.parent!, checker)
                    }' cannot be accessed during class initialization.`;
            if (
                // checking use before assign in constructor requires control flow graph
                useDuringClassInitialization.kind !== ts.SyntaxKind.Constructor &&
                // only checking read access
                getAccessKind(node) & AccessKind.Read &&
                isPropertyUsedBeforeAssign(symbol.valueDeclaration!, useDuringClassInitialization, compilerOptions, checker)
            )
                return `Property '${name}' is used before its initialization.`;
        }
    }
    if (node.expression.kind === ts.SyntaxKind.SuperKeyword && (flags & ts.ModifierFlags.Static) === 0 && !isStaticSuper(node)) {
        if (hasNonPrototypeDeclaration(symbol))
            return "Only public and protected methods and accessors of the base class are accessible via the 'super' keyword.";
        if (
            flags & ts.ModifierFlags.Abstract &&
            symbol.declarations!.every((d) => hasModifier(d.modifiers, ts.SyntaxKind.AbstractKeyword))
        )
            return `Abstract member '${name}' in class '${printClass(getDeclaringClassOfProperty(symbol.valueDeclaration!), checker)}' cannot be accessed via the 'super' keyword.`;
    }

    if ((flags & ts.ModifierFlags.NonPublicAccessibilityModifier) === 0)
        return;
    if (flags & ts.ModifierFlags.Private) {
        const declaringClass = getDeclaringClassOfProperty(symbol.valueDeclaration!);
        if (node.pos < declaringClass.pos || node.end > declaringClass.end)
            return failVisibility(name, printClass(declaringClass, checker), true);
    } else {
        const declaringClasses = symbol.declarations!.map(getDeclaringClassOfProperty);
        let enclosingClass = findEnclosingClass(node.parent!, declaringClasses, checker);
        if (enclosingClass === undefined) {
            if ((flags & ts.ModifierFlags.Static) === 0)
                enclosingClass = getEnclosingClassFromThisParameter(node.parent!, declaringClasses, checker);
            if (enclosingClass === undefined)
                return failVisibility(name, checker.typeToString(lhsType), false);
        }
        if ((flags & ts.ModifierFlags.Static) === 0 && !hasBase(lhsType, enclosingClass, isIdentical))
            return `Property '${name}' is protected and only accessible through an instance of class '${checker.typeToString(enclosingClass)}'.`;
    }
    return;
}

function failVisibility(property: string, typeString: string, isPrivate: boolean) {
    return `Property '${property}' is ${isPrivate ? 'private' : 'protected'} and only accessible within class '${typeString}'${isPrivate ? '' : ' and its subclasses'}.`;
}

function findEnclosingClass(node: ts.Node, baseClasses: ts.ClassLikeDeclaration[], checker: ts.TypeChecker) {
    while (true) {
        switch (node.kind) {
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression: {
                const declaredType = getInstanceTypeOfClassLikeDeclaration(<ts.ClassLikeDeclaration>node, checker);
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

function printClass(declaration: ts.ClassLikeDeclaration, checker: ts.TypeChecker) {
    return checker.typeToString(getInstanceTypeOfClassLikeDeclaration(declaration, checker));
}

function getEnclosingClassFromThisParameter(node: ts.Node, baseClasses: ts.ClassLikeDeclaration[], checker: ts.TypeChecker) {
    const thisParameter = getThisParameterFromContext(node);
    if (thisParameter?.type === undefined)
        return;
    let thisType = checker.getTypeFromTypeNode(thisParameter.type);
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

function getPropertyDeclarationOrConstructorAccessingProperty(node: ts.Node) {
    while (true) {
        if (isFunctionScopeBoundary(node))
            return node.kind === ts.SyntaxKind.Constructor ? <ts.ConstructorDeclaration>node : undefined;
        if (node.kind === ts.SyntaxKind.PropertyDeclaration)
            return <ts.PropertyDeclaration>node;
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

function isPropertyUsedBeforeAssign(
    prop: ts.Declaration,
    usedIn: ts.PropertyDeclaration,
    compilerOptions: ts.CompilerOptions,
    checker: ts.TypeChecker,
): boolean {
    if (isParameterDeclaration(prop))
    // when emitting native class fields, parameter properties cannot be used in other property's initializers in the same class
        return prop.parent!.parent === usedIn.parent && isEmittingNativeClassFields(compilerOptions);
    // this also matches assignment declarations in the same class; we could handle them, but TypeScript doesn't, so why bother
    if (prop.parent !== usedIn.parent)
        return false;
    // property is declared before use in the same class
    if (prop.pos < usedIn.pos) {
        // OK if immediately initialized
        if ((<ts.PropertyDeclaration>prop).initializer !== undefined || (<ts.PropertyDeclaration>prop).exclamationToken !== undefined)
            return false;
        // NOT OK if [[Define]] semantics are used, because it overrides the property from the base class
        if (
            !hasModifier(prop.modifiers, ts.SyntaxKind.DeclareKeyword) &&
            isCompilerOptionEnabled(compilerOptions, 'useDefineForClassFields')
        )
            return true;
    }
    return getBaseClassMemberOfClassElement(<ts.PropertyDeclaration>prop, checker) === undefined;
}

function isEmittingNativeClassFields(compilerOptions: ts.CompilerOptions) {
    return compilerOptions.target === ts.ScriptTarget.ESNext && isCompilerOptionEnabled(compilerOptions, 'useDefineForClassFields');
}

function getDeclaringClassOfProperty(decl: ts.Declaration) {
    return <ts.ClassLikeDeclaration>(decl.kind === ts.SyntaxKind.Parameter ? decl.parent!.parent : decl.parent);
}
