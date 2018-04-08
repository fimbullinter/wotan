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
                default:
                    if (!isJs && isFunctionWithBody(node))
                        this.checkFunctionParameters(node.parameters);
            }
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
        if (property === undefined || property.flags & ts.SymbolFlags.Optional)
            return false;
        return unionTypeParts(checker.getTypeOfSymbolAtLocation(property, node.parent!))
            .every((t) => (t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Any)) === 0);
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

function isUndefined(node: ts.Expression) {
    return isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword;
}
