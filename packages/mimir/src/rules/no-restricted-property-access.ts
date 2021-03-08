import { excludeDeclarationFiles, TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { propertiesOfType } from '../utils';
import { getLateBoundPropertyNames, isTypeFlagSet } from 'tsutils';
import { getRestrictedElementAccessError } from '../restricted-property';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst())
            if (node.kind === ts.SyntaxKind.ElementAccessExpression)
                this.checkElementAccess(<ts.ElementAccessExpression>node);
    }

    private checkElementAccess(node: ts.ElementAccessExpression) {
        const type = this.checker.getApparentType(this.checker.getTypeAtLocation(node.expression)).getNonNullableType();
        // TODO remove this check once https://github.com/microsoft/TypeScript/issues/41021 is fixed
        if (isTypeFlagSet(type, ts.TypeFlags.Never))
            return this.addFindingAtNode(node, "Invalid element access on type 'never'.");

        const {names} = getLateBoundPropertyNames(node.argumentExpression, this.checker);
        if (names.length === 0)
            return;
        for (const {symbol, name} of propertiesOfType(type, names)) {
            const error = getRestrictedElementAccessError(this.checker, symbol, name, node, type, this.context.compilerOptions);
            if (error !== undefined)
                this.addFindingAtNode(node, error);
        }
    }
}
