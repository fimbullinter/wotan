import * as ts from 'typescript';
import { isBreakOrContinueStatement, isLabeledStatement } from 'tsutils';
import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import { childStatements } from '../utils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (node.kind === ts.SyntaxKind.LabeledStatement) {
                const {label, statement} = <ts.LabeledStatement>node;
                if (!usesLabel(statement, label.text)) {
                    const start = label.getStart(this.sourceFile);
                    this.addFailure(
                        start,
                        label.end,
                        `Unused label '${label.text}'.`,
                        Replacement.delete(start, statement.getStart(this.sourceFile)),
                    );
                }
            }
        }
    }
}

function usesLabel(node: ts.Statement, label: string): boolean {
    if (isBreakOrContinueStatement(node))
        return node.label !== undefined && node.label.text === label;
    if (isLabeledStatement(node))
        return node.label.text !== label && usesLabel(node.statement, label);
    for (const statement of childStatements(node))
        if (usesLabel(statement, label))
            return true;
    return false;
}
