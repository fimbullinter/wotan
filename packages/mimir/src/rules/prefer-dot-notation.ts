import { Replacement, excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import { isCompilerOptionEnabled, isTextualLiteral, isTypeFlagSet, isValidPropertyAccess } from 'tsutils';
import * as ts from 'typescript';
import { getRestrictedElementAccessError } from '../restricted-property';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.ElementAccessExpression)
                this.checkElementAccess(<ts.ElementAccessExpression>node);
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        if (!isTextualLiteral(node.argumentExpression))
            return;
        const {text} = node.argumentExpression;
        if (!isValidPropertyAccess(text) || this.hasCompileErrorIfWrittenAsPropertyAccess(node, text))
            return;

        this.addFindingAtNode(
            node.argumentExpression,
            `Prefer 'obj.${text}' over 'obj[${node.argumentExpression.getText(this.sourceFile)}]'.`,
            node.expression.kind === ts.SyntaxKind.NumericLiteral
                ? [
                    Replacement.append(node.expression.getStart(this.sourceFile), '('),
                    Replacement.replace(node.expression.end, node.end, ').' + text),
                ]
                : Replacement.replace(node.expression.end, node.end, (node.questionDotToken !== undefined ? '?.' : '.') + text),
        );
    }

    private hasCompileErrorIfWrittenAsPropertyAccess(node: ts.ElementAccessExpression, name: string): boolean {
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node.expression)).getNonNullableType();
        if (isTypeFlagSet(type, ts.TypeFlags.Any))
            return false;
        const symbol = type.getProperty(name);
        if (symbol === undefined) {
            if (type.getStringIndexType() === undefined)
                return true; // should already be a compile error, don't mess with invalid code
            return isCompilerOptionEnabled(this.context.compilerOptions, 'noPropertyAccessFromIndexSignature');
        }
        return getRestrictedElementAccessError(this.checker, symbol, name, node, type, this.context.compilerOptions) !== undefined;
    }
}
