import * as ts from 'typescript';
import { isLabeledStatement, isIterationStatement, isBreakOrContinueStatement, isFunctionScopeBoundary } from 'tsutils';
import { AbstractRule, Replacement } from '../types';
import bind from 'bind-decorator';

interface Label {
    node: ts.LabeledStatement;
    name: string;
    used: boolean;
}

export class Rule extends AbstractRule {
    private labels: Label[] = [];

    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        return this.sourceFile.statements.forEach(this.visitNode);
    }

    @bind
    private visitNode(node: ts.Node): void {
        if (isLabeledStatement(node)) {
            if (!isIterationStatement(node.statement) && node.statement.kind !== ts.SyntaxKind.SwitchStatement) {
                this.fail(node);
                return this.visitNode(node.statement);
            }
            this.labels.unshift({node, name: node.label.text, used: false});
            this.visitNode(node.statement);
            const label = this.labels.shift()!;
            if (!label.used)
                this.fail(label.node);
            return;
        }
        if (isBreakOrContinueStatement(node)) {
            if (node.label !== undefined) {
                const name = node.label.text;
                const label = this.labels.find((l) => l.name === name);
                if (label !== undefined)
                    label.used = true;
            }
            return;
        }
        if (this.labels.length !== 0 && isFunctionScopeBoundary(node)) {
            const saved = this.labels;
            this.labels = [];
            ts.forEachChild(node, this.visitNode);
            this.labels = saved;
            return;
        }
        return ts.forEachChild(node, this.visitNode);
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
