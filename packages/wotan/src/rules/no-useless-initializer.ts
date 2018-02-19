import { AbstractRule, Replacement } from '../types';
import * as ts from 'typescript';
import { isIdentifier, getChildOfKind, isFunctionWithBody, isUnionTypeNode, getPreviousToken, getNextToken } from 'tsutils';

export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.VariableDeclaration:
                    if (node.parent!.flags & ts.NodeFlags.Const)
                        break;
                    // falls through
                case ts.SyntaxKind.BindingElement:
                    if ((<ts.HasExpressionInitializer>node).initializer !== undefined &&
                        isUndefined((<ts.HasExpressionInitializer>node).initializer!))
                        this.fail(<ts.HasExpressionInitializer>node);
                    break;
                default:
                    if (isFunctionWithBody(node))
                        this.checkFunctionParameters(node.parameters);
            }
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
        if (makeOptional !== undefined) {
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
