import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { elementAccessSymbols } from '../utils';
import { isThisParameter, isTypeParameter, isTypeReference, isIntersectionType } from 'tsutils';

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
            this.checkSymbol(symbol, name, node);
    }

    private checkComputedProperty(_node: ts.ComputedPropertyName) {

    }

    private checkSymbol(symbol: ts.Symbol, name: string, errorNode: ts.Node) {
        const flags = getModifierFlagsOfSymbol(symbol);
        // TODO check all other stuff here

        if ((flags & ts.ModifierFlags.NonPublicAccessibilityModifier) === 0)
            return;
        if (flags & ts.ModifierFlags.Private) {
            const declaration = getMatchingDeclaration(symbol, ts.ModifierFlags.Private);
            const declaringClass = declaration.parent!;
            if (errorNode.pos < declaringClass.pos || errorNode.end > declaringClass.end)
                this.failVisibility(errorNode, name, declaringClass, true);
        } else {
            const declaration = getMatchingDeclaration(symbol, ts.ModifierFlags.Protected);
            const declaringClass = declaration.parent!;
            let enclosingClass = this.findEnclosingClass(errorNode.parent!.parent!, declaringClass);
            if (enclosingClass === undefined) {
                if ((flags & ts.ModifierFlags.Static) === 0)
                    enclosingClass = this.getEnclosingClassFromThisParameter(errorNode.parent!.parent!, declaringClass);
                if (enclosingClass === undefined)
                    return this.failVisibility(errorNode, name, declaringClass, false);
            }
        }
    }

    private getEnclosingClassFromThisParameter(node: ts.Node, baseClass: ts.ClassLikeDeclaration) {
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
        return hasBaseType(thisType, baseClass) ? thisType : undefined;
    }

    private failVisibility(node: ts.Node, property: string, clazz: ts.ClassLikeDeclaration, isPrivate: boolean) {
        this.addFailureAtNode(
            node,
            `Property '${property}' is ${isPrivate ? 'private' : 'protected'} and only accessible within class '${this.printClass(clazz)}'${
                isPrivate ? '' : ' and its subclasses'
            }.`,
        );
    }

    private findEnclosingClass(node: ts.Node, baseClass: ts.ClassLikeDeclaration) {
        while (true) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression: {
                    const declaredType = this.getDeclaredType(<ts.ClassLikeDeclaration>node);
                    if (hasBaseType(declaredType, baseClass))
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
        return this.checker.getDeclaredTypeOfSymbol(this.getSymbolOfClassLikeDeclaration(declaration));
    }

    private getSymbolOfClassLikeDeclaration(declaration: ts.ClassLikeDeclaration) {
        if (declaration.name !== undefined)
            return this.checker.getSymbolAtLocation(declaration.name)!;
        return this.checker.getTypeAtLocation(declaration).symbol!;
    }
}

function getMatchingDeclaration(symbol: ts.Symbol, flags: ts.ModifierFlags) {
    return symbol.declarations!.find((d): d is ts.PropertyDeclaration => (ts.getCombinedModifierFlags(d) & flags) !== 0)!;
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
    if (symbol.declarations !== undefined)
        for (const declaration of symbol.declarations)
            flags |= ts.getCombinedModifierFlags(declaration);
    return flags;
}
