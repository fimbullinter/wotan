import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isIdentifier,
    getChildOfKind,
    isFunctionWithBody,
    isUnionTypeNode,
    getPreviousToken,
    getNextToken,
    getPropertyName,
    unionTypeParts,
    isReassignmentTarget,
    isBinaryExpression,
} from 'tsutils';
import { isStrictNullChecksEnabled } from '../utils';

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
                case ts.SyntaxKind.BindingElement:
                    if ((<ts.BindingElement>node).initializer !== undefined && this.isUselessBindingElementDefault(<ts.BindingElement>node))
                        this.failDestructuringDefault(<ts.BindingElement>node);
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
        if (this.program === undefined || !isStrictNullChecksEnabled(this.program.getCompilerOptions()))
            return;
        const checker = this.program.getTypeChecker();
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
                this.addFailureAtNode(
                    errorNode,
                    "Unnecessary default value as this property is never 'undefined'.",
                    Replacement.delete(getChildOfKind(errorNode.parent!, ts.SyntaxKind.EqualsToken, this.sourceFile)!.pos, errorNode.end),
                );
        }
    }

    private isUselessBindingElementDefault(node: ts.BindingElement): boolean {
        if (this.program === undefined || !isStrictNullChecksEnabled(this.program.getCompilerOptions()))
            return false;
        const checker = this.program.getTypeChecker();
        const name = getPropertyName(node.propertyName === undefined ? <ts.Identifier>node.name : node.propertyName);
        if (name === undefined)
            return false;
        const type = checker.getApparentType(checker.getTypeAtLocation(node.parent!));
        const property = type.getProperty(name);
        return property !== undefined && !symbolMaybeUndefined(checker, property, node);
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

    private failDestructuringDefault(node: ts.BindingElement) {
        const fix =
            this.program!.getTypeChecker().getTypeAtLocation(node.propertyName || node.name).flags & (ts.TypeFlags.Union | ts.TypeFlags.Any)
                // TODO we currently cannot autofix this case: it's possible to use a default value that's not assignable to the
                // destructured type. The type of the variable then includes the type of the initializer as well.
                // Removing the initializer might also remove its type from the union type causing type errors elsewhere.
                // We try to prevent errors by checking if the resulting type is a union type.
                ? undefined
                : Replacement.delete(getChildOfKind(node, ts.SyntaxKind.EqualsToken, this.sourceFile)!.pos, node.end);
        this.addFailureAtNode(node.initializer!, "Unnecessary default value as this property is never 'undefined'.", fix);
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
        this.addFailure(node.end - 'undefined'.length, node.end, message, fix);
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

function symbolMaybeUndefined(checker: ts.TypeChecker, symbol: ts.Symbol, node: ts.Node): boolean {
    if (symbol.flags & ts.SymbolFlags.Optional)
        return true;
    return unionTypeParts(checker.getTypeOfSymbolAtLocation(symbol, node))
        .some((t) => (t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Any)) !== 0);
}

function isUndefined(node: ts.Expression) {
    return isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword;
}
