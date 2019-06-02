import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isIdentifier,
    getChildOfKind,
    isFunctionWithBody,
    isUnionTypeNode,
    getPreviousToken,
    getNextToken,
    isReassignmentTarget,
    isBinaryExpression,
    isStrictCompilerOptionEnabled,
    isInstantiableType,
    isUnionType,
    PropertyName,
    getPropertyOfType,
    LateBoundPropertyNames,
    getLateBoundPropertyNamesOfPropertyName,
} from 'tsutils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const isJs = this.sourceFile.flags & ts.NodeFlags.JavaScriptFile;
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.VariableDeclaration:
                    if (
                        (<ts.VariableDeclaration>node).initializer !== undefined &&
                        (node.parent!.flags & ts.NodeFlags.Const) === 0 &&
                        isUndefined((<ts.VariableDeclaration>node).initializer!)
                    )
                        this.fail(<ts.VariableDeclaration>node);
                    break;
                case ts.SyntaxKind.ObjectBindingPattern:
                    this.checkBindingPattern(<ts.ObjectBindingPattern>node, getObjectPropertyName);
                    break;
                case ts.SyntaxKind.ArrayBindingPattern:
                    this.checkBindingPattern(<ts.ArrayBindingPattern>node, getArrayPropertyName);
                    break;
                case ts.SyntaxKind.ObjectLiteralExpression:
                    if (isReassignmentTarget(<ts.ObjectLiteralExpression>node))
                        this.checkObjectDestructuring(<ts.ObjectLiteralExpression>node);
                    break;
                default:
                    if (!isJs && isFunctionWithBody(node))
                        this.checkFunctionParameters(node.parameters);
            }
        }
    }

    private checkObjectDestructuring(node: ts.ObjectLiteralExpression) {
        if (this.context.compilerOptions === undefined || !isStrictCompilerOptionEnabled(this.context.compilerOptions, 'strictNullChecks'))
            return;
        const checker = this.program!.getTypeChecker();
        for (const property of node.properties) {
            let name: ts.Identifier;
            let errorNode: ts.Expression;
            switch (property.kind) {
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                    if (property.objectAssignmentInitializer === undefined)
                        continue;
                    name = property.name;
                    errorNode = property.objectAssignmentInitializer;
                    break;
                case ts.SyntaxKind.PropertyAssignment:
                    if (property.name.kind !== ts.SyntaxKind.Identifier || !isBinaryExpression(property.initializer))
                        continue;
                    name = property.name;
                    errorNode = property.initializer.right;
                    break;
                default:
                    continue;
            }
            const symbol = checker.getPropertySymbolOfDestructuringAssignment(name);
            if (symbol !== undefined && !symbolMaybeUndefined(checker, symbol, name))
                this.addFindingAtNode(
                    errorNode,
                    "Unnecessary default value as this property is never 'undefined'.",
                    Replacement.delete(getChildOfKind(errorNode.parent!, ts.SyntaxKind.EqualsToken, this.sourceFile)!.pos, errorNode.end),
                );
        }
    }

    private checkBindingPattern(node: ts.BindingPattern, propNames: typeof getObjectPropertyName) {
        if (this.context.compilerOptions === undefined || !isStrictCompilerOptionEnabled(this.context.compilerOptions, 'strictNullChecks'))
            return;
        const checker = this.program!.getTypeChecker();
        let type: ts.Type | undefined;
        for (let i = 0; i < node.elements.length; ++i) {
            const element = node.elements[i];
            if (element.kind === ts.SyntaxKind.OmittedExpression || element.initializer === undefined)
                continue;
            const lateBoundNames = propNames(element, i, checker);
            if (!lateBoundNames.known || lateBoundNames.names.some(maybeUndefined))
                continue;
            // TODO we currently cannot autofix this case: it's possible to use a default value that's not assignable to the
            // destructured type. The type of the variable then includes the type of the initializer as well.
            // Removing the initializer might also remove its type from the union type causing type errors elsewhere.
            this.addFindingAtNode(element.initializer, "Unnecessary default value as this property is never 'undefined'.");
        }

        function maybeUndefined({symbolName}: PropertyName) {
            const symbol = getPropertyOfType(type || (type = checker.getApparentType(checker.getTypeAtLocation(node)!)), symbolName);
            return symbol === undefined || symbolMaybeUndefined(checker, symbol, node);
        }
    }

    private checkFunctionParameters(parameters: ReadonlyArray<ts.ParameterDeclaration>) {
        let allOptional = true;
        for (let i = parameters.length - 1; i >= 0; --i) {
            const parameter = parameters[i];
            if (parameter.initializer !== undefined) {
                if (isUndefined(parameter.initializer))
                    this.fail(parameter, allOptional);
            } else if (parameter.questionToken === undefined && parameter.dotDotDotToken === undefined) {
                allOptional = false;
            }
        }
    }

    private fail(node: ts.HasExpressionInitializer, makeOptional?: boolean) {
        const fix = [Replacement.delete(getChildOfKind(node, ts.SyntaxKind.EqualsToken, this.sourceFile)!.pos, node.end)];
        let message = "Unnecessary initialization with 'undefined'.";
        if (makeOptional) {
            fix.push(Replacement.append(node.name.end, '?'));
            const removeUndefined = this.removeUndefinedFromType((<ts.ParameterDeclaration>node).type);
            if (removeUndefined !== undefined)
                fix.push(removeUndefined);
            message += ' Use an optional parameter instead.';
        }
        this.addFinding(node.end - 'undefined'.length, node.end, message, fix);
    }

    private removeUndefinedFromType(type: ts.TypeNode | undefined): Replacement | undefined {
        if (type === undefined || !isUnionTypeNode(type))
            return;
        for (let i = 0; i < type.types.length; ++i) {
            const t = type.types[i];
            if (t.kind === ts.SyntaxKind.UndefinedKeyword) {
                const bar = (i === 0 ? getNextToken : getPreviousToken)(t, this.sourceFile)!;
                return Replacement.delete(Math.min(t.pos, bar.pos), Math.max(t.end, bar.end));
            }
        }
        return;
    }
}

function getObjectPropertyName(property: ts.BindingElement, _i: number, checker: ts.TypeChecker): LateBoundPropertyNames {
    if (property.propertyName === undefined)
        return {
            known: true,
            names: [{displayName: (<ts.Identifier>property.name).text, symbolName: (<ts.Identifier>property.name).escapedText }],
        };
    return getLateBoundPropertyNamesOfPropertyName(property.propertyName, checker);

}

function getArrayPropertyName(_: ts.BindingElement, i: number): LateBoundPropertyNames {
    const name = String(i);
    return {known: true, names: [{displayName: name, symbolName: <ts.__String>name}]};
}

function symbolMaybeUndefined(checker: ts.TypeChecker, symbol: ts.Symbol, node: ts.Node): boolean {
    if (symbol.flags & (ts.SymbolFlags.Optional | (Number.isNaN(+symbol.escapedName) ? 0 : ts.SymbolFlags.Transient)))
        return true;
    return typeMaybeUndefined(checker, checker.getTypeOfSymbolAtLocation(symbol, node));
}

function typeMaybeUndefined(checker: ts.TypeChecker, type: ts.Type): boolean {
    if (isInstantiableType(type)) {
        const constraint = checker.getBaseConstraintOfType(type);
        if (constraint === undefined)
        return true;
        type = constraint;
    }
    if (isUnionType(type))
        return type.types.some((t) => typeMaybeUndefined(checker, t));
    return (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;
}

function isUndefined(node: ts.Expression) {
    return isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword;
}
