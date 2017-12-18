import * as ts from 'typescript';
import { isLabeledStatement, isIterationStatement, isBreakOrContinueStatement, isFunctionScopeBoundary } from 'tsutils';
import { AbstractRule, Replacement } from '../types';

interface Label {
    node: ts.LabeledStatement;
    name: string;
    used: boolean;
}

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }
    public apply() {
        let labels: Label[] = [];
        const cb = (node: ts.Node): void => {
            if (isLabeledStatement(node)) {
                if (!isIterationStatement(node.statement) && node.statement.kind !== ts.SyntaxKind.SwitchStatement) {
                    this.fail(node);
                    return cb(node.statement);
                }
                labels.unshift({node, name: node.label.text, used: false});
                cb(node.statement);
                const label = labels.shift()!;
                if (!label.used)
                    this.fail(label.node);
                return;
            }
            if (isBreakOrContinueStatement(node)) {
                if (node.label !== undefined) {
                    const name = node.label.text;
                    const label = labels.find((l) => l.name === name);
                    if (label !== undefined)
                        label.used = true;
                }
                return;
            }
            if (labels.length !== 0 && isFunctionScopeBoundary(node)) {
                const saved = labels;
                labels = [];
                ts.forEachChild(node, cb);
                labels = saved;
                return;
            }
            return ts.forEachChild(node, cb);
        };

        return this.sourceFile.statements.forEach(cb);
    }

    private fail(statement: ts.LabeledStatement) {
        const start = statement.label.getStart(this.sourceFile);
        this.addFailure(
            start,
            statement.label.end,
            `Unused label '${statement.label.text}'.`,
            Replacement.delete(start, statement.statement.getStart(this.sourceFile)),
        );
    }
}
