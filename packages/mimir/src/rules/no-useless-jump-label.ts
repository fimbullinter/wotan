import { AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isBreakOrContinueStatement, isFunctionScopeBoundary, isIterationStatement, isLabeledStatement } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const node of this.context.getFlatAst())
            if (isBreakOrContinueStatement(node) && node.label !== undefined && !isLabelNecessary(node.label))
                this.addFailureAtNode(
                    node.label,
                    `Label '${node.label.text}' is unnecessary.`,
                    Replacement.delete(node.label.pos, node.label.end),
                );
    }
}

function isLabelNecessary(label: ts.Identifier) {
    let parent = label.parent!;
    const isBreak = parent.kind === ts.SyntaxKind.BreakStatement;

    do {
        parent = parent.parent!;
        if (isIterationStatement(parent) || isBreak && parent.kind === ts.SyntaxKind.SwitchStatement) {
            // we found the closest jump target. now we need to check if it has the same label as the jump statement
            parent = parent.parent!;
            while (isLabeledStatement(parent)) {
                if (parent.label.text === label.text)
                    return false; // label is present on the closest jump target
                parent = parent.parent!;
            }
            return true; // label is not present on the closest jump target
        }
        if (isBreak && isLabeledStatement(parent) && parent.label.text === label.text)
            return true; // label is not on an IterationStatement or SwitchStatement -> breaking out of blocks always requires label

    } while (!isFunctionScopeBoundary(parent) && parent.kind !== ts.SyntaxKind.SourceFile);

    return true; // label is not in scope, should never get here in correct code
}
