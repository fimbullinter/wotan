import { TypedRule, Replacement, excludeDeclarationFiles, requireLibraryFile } from '@fimbul/ymir';
import * as ts from 'typescript';
import { WrappedAst, getWrappedNodeAtPosition, isIdentifier, isCallExpression, isTypeVariable, isUnionType } from 'tsutils';
import debug = require('debug');

const log = debug('wotan:rule:prefer-number-isnan');

@excludeDeclarationFiles
@requireLibraryFile('lib.es2015.core.d.ts', log)
export class Rule extends TypedRule {
    public apply() {
        const re = /\bisNaN\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (!isIdentifier(node) || node.end !== re.lastIndex || node.text !== 'isNaN')
                continue;
            const parent = node.parent!;
            if (isCallExpression(parent) && parent.expression === node && parent.arguments.length === 1 &&
                this.isNumberLikeType(this.checker.getTypeAtLocation(parent.arguments[0])))
                this.addFailure(
                    match.index,
                    re.lastIndex,
                    "Prefer 'Number.isNaN' over 'isNaN'.",
                    Replacement.append(match.index, 'Number.'),
                );
        }
    }

    private isNumberLikeType(type: ts.Type): boolean {
        if (isTypeVariable(type)) {
            const base = this.checker.getBaseConstraintOfType(type);
            if (base === undefined)
                return false;
            type = base;
        }
        if (type.flags & ts.TypeFlags.NumberLike)
            return true;
        return isUnionType(type) && type.types.every(this.isNumberLikeType, this);
    }
}
