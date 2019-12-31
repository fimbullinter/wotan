import { TypedRule, Replacement, excludeDeclarationFiles, requireLibraryFile } from '@fimbul/ymir';
import * as ts from 'typescript';
import { WrappedAst, getWrappedNodeAtPosition, isIdentifier, isCallExpression, unionTypeParts } from 'tsutils';
import { tryGetBaseConstraintType } from '../utils';

@excludeDeclarationFiles
@requireLibraryFile('lib.es2015.core.d.ts')
export class Rule extends TypedRule {
    public apply() {
        const re = /\b(?:isNaN|isFinite)\s*[/(]/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst ??= this.context.getWrappedAst(), match.index)!;
            if (!isIdentifier(node) || node.text !== 'isNaN' && node.text !== 'isFinite' || node.end - node.text.length !== match.index)
                continue;
            const parent = node.parent!;
            if (isCallExpression(parent) && parent.expression === node && parent.arguments.length === 1 &&
                this.isCorrectArgumentType(parent.arguments[0]))
                this.addFinding(
                    match.index,
                    node.end,
                    `Prefer 'Number.${node.text}' over '${node.text}'.`,
                    Replacement.append(match.index, 'Number.'),
                );
        }
    }

    private isCorrectArgumentType(arg: ts.Expression) {
        return unionTypeParts(
            tryGetBaseConstraintType(this.checker.getTypeAtLocation(arg), this.checker),
        ).every((t) => (t.flags & ts.TypeFlags.NumberLike) !== 0);
    }
}
