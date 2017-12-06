import * as ts from 'typescript';
import { isLabeledStatement, isIterationStatement, isBreakOrContinueStatement, isFunctionScopeBoundary } from 'tsutils';
import { RuleFailure, AbstractRule } from '../linter';

interface Label {
    node: ts.LabeledStatement;
    name: string;
    used: boolean;
}

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }
    public apply(sourceFile: ts.SourceFile) {
        const failures: RuleFailure[] = [];
        let labels: Label[] = [];
        const cb = (node: ts.Node): void => {
            if (isLabeledStatement(node)) {
                if (!isIterationStatement(node.statement) && node.statement.kind !== ts.SyntaxKind.SwitchStatement) {
                    addFailure(node);
                    return cb(node.statement);
                }
                labels.unshift({node, name: node.label.text, used: false});
                cb(node.statement);
                const label = labels.shift()!;
                if (!label.used)
                    addFailure(label.node);
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

        sourceFile.statements.forEach(cb);

        return failures;

        function addFailure(statement: ts.LabeledStatement) {
            const start = statement.label.getStart(sourceFile);
            failures.push({
                start,
                end: statement.label.end,
                message: `Unused label '${statement.label.text}'.`,
                fix: {
                    start,
                    end: statement.statement.getStart(sourceFile),
                    text: '',
                },
            });
        }
    }
}
