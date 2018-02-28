import { TypedRule, Replacement } from '../types';
import * as ts from 'typescript';
import { WrappedAst, getWrappedNodeAtPosition, isIdentifier, isCallExpression, isTypeVariable, isUnionType } from 'tsutils';
import * as path from 'path';
import debug = require('debug');

const log = debug('wotan:rule:prefer-number-isnan');

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        if (!this.supportsNumberIsNaN())
            return;
        const re = /\bisNaN\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (!isIdentifier(node) || node.end !== re.lastIndex || node.text !== 'isNaN')
                continue;
            const parent = node.parent!;
            if (isCallExpression(parent) && parent.expression === node && parent.arguments.length === 1)
                this.checkCall(parent);
        }
    }

    private checkCall(node: ts.CallExpression) {
        const arg = node.arguments[0];
        // don't complain if parameter is not a number because of the different semantics of Number.isNaN
        if (!this.isNumberLikeType(this.checker.getTypeAtLocation(arg)))
            return;
        const start = node.getStart(this.sourceFile);
        this.addFailure(start, node.expression.end, "Prefer 'Number.isNaN' over 'isNaN'.", Replacement.append(start, 'Number.'));
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

    private supportsNumberIsNaN(): boolean {
        const libFileDir = path.dirname(ts.getDefaultLibFilePath(this.program.getCompilerOptions()));
        if (this.program.getSourceFile(path.join(libFileDir, 'lib.es2015.core.d.ts')) === undefined) {
            log("Project does not contain 'lib.es2015.core.d.ts'");
            return false;
        }
        return true;
    }
}
