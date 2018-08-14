import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { elementAccessSymbols } from '../utils';
import { isThisParameter, isTypeParameter, isTypeReference, isIntersectionType, isFunctionScopeBoundary } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.ElementAccessExpression:
                    this.checkElementAccess(<ts.ElementAccessExpression>node);
                    break;
                case ts.SyntaxKind.ComputedPropertyName:
                    this.checkComputedProperty(<ts.ComputedPropertyName>node);
            }
        }
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        for (const {symbol, name} of elementAccessSymbols(node, this.checker))
            this.checkSymbol(symbol, name, node, node.expression, this.checker.getTypeAtLocation(node.expression));
    }

    private checkComputedProperty(_node: ts.ComputedPropertyName) {

    }

    private checkSymbol(symbol: ts.Symbol, name: string, errorNode: ts.Node, lhs: ts.Expression | undefined, lhsType: ts.Type) {
        const flags = getModifierFlagsOfSymbol(symbol);

        if (hasConflictingAccessModifiers(flags))
            return this.addFailureAtNode(
                errorNode,
                `Property '${name}' has conflicting declarations and is inaccessible in type '${this.checker.typeToString(lhsType)}'.`,
            );

        if (
            lhs !== undefined && lhs.kind === ts.SyntaxKind.ThisKeyword &&
            flags & ts.ModifierFlags.Abstract && symbol.flags & ts.SymbolFlags.Property
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
            if ((symbol.flags & ts.SymbolFlags.Method) === 0)
                return this.addFailureAtNode(
                    errorNode,
                    "Only public and protected methods of the base class are accessible via the 'super' keyword.",
                );
            if (flags & ts.ModifierFlags.Abstract) {
                const [{parent: declaringClass}] = getMatchingDeclarations(symbol, ts.ModifierFlags.Abstract);
                return this.addFailureAtNode(
                    errorNode,
                    `Abstract method '${name}' in class '${this.printClass(declaringClass)}' cannot be accessed via the 'super' keyword.`,
                );
            }
        }

        if ((flags & ts.ModifierFlags.NonPublicAccessibilityModifier) === 0)
            return;
        if (flags & ts.ModifierFlags.Private) {
            const [{parent: declaringClass}] = getMatchingDeclarations(symbol, ts.ModifierFlags.Private);
            if (errorNode.pos < declaringClass.pos || errorNode.end > declaringClass.end)
                this.failVisibility(errorNode, name, declaringClass, true);
        } else {
            const declaringClasses = Array.from(getMatchingDeclarations(symbol, ts.ModifierFlags.Protected), (d) => d.parent);
            let enclosingClass = this.findEnclosingClass(errorNode.parent!.parent!, declaringClasses);
            if (enclosingClass === undefined) {
                if ((flags & ts.ModifierFlags.Static) === 0)
                    enclosingClass = this.getEnclosingClassFromThisParameter(errorNode.parent!.parent!, declaringClasses);
                if (enclosingClass === undefined)
                    return this.failVisibility(errorNode, name, declaringClasses[0], false);
            }
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
        return baseClasses.every((baseClass) => hasBaseType(thisType, baseClass)) ? thisType : undefined;
    }

    private failVisibility(node: ts.Node, property: string, clazz: ts.ClassLikeDeclaration, isPrivate: boolean) {
        this.addFailureAtNode(
            node,
            `Property '${property}' is ${isPrivate ? 'private' : 'protected'} and only accessible within class '${this.printClass(clazz)}'${
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
                    if (baseClasses.every((baseClass) => hasBaseType(declaredType, baseClass)))
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

function hasConflictingAccessModifiers(flags: ts.ModifierFlags) {
    let result = 0;
    if (flags & ts.ModifierFlags.Public)
        ++result;
    if (flags & ts.ModifierFlags.Protected)
        ++result;
    if (flags & ts.ModifierFlags.Private)
        ++result;
    return result > 1;
}

function* getMatchingDeclarations(symbol: ts.Symbol, flags: ts.ModifierFlags) {
    for (const declaration of symbol.declarations!)
        if (ts.getCombinedModifierFlags(declaration) & flags)
            yield <(ts.PropertyDeclaration | ts.MethodDeclaration | ts.AccessorDeclaration) & {parent: ts.ClassLikeDeclaration}>declaration;
}

function hasBaseType(type: ts.Type, declaration: ts.Declaration) {
    return (function check(t): boolean {
        if (isTypeReference(t)) {
            t = t.target;
            if (t.symbol !== undefined && t.symbol.declarations !== undefined && t.symbol.declarations.includes(declaration))
                return true;
        }
        const baseTypes = t.getBaseTypes();
        if (baseTypes !== undefined && baseTypes.some(check))
            return true;
        return isIntersectionType(t) && t.types.some(check);
    })(type);
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
    let flags = ts.ModifierFlags.None;
    if (symbol.declarations !== undefined) {
        for (const declaration of symbol.declarations) {
            const current = ts.getCombinedModifierFlags(declaration);
            flags |= current;
            if ((current & ts.ModifierFlags.NonPublicAccessibilityModifier) === 0)
                flags |= ts.ModifierFlags.Public; // add public modifier if property is implicitly public
        }
    }
    return flags;
}
