import * as ts from 'typescript';
import { isLabeledStatement, isBreakOrContinueStatement, isFunctionScopeBoundary, NodeWrap } from 'tsutils';
import { AbstractRule, Replacement } from '../types';

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
        return this.iterate(this.context.getWrappedAst().next, undefined);
    }

    private iterate(wrap: NodeWrap, end: NodeWrap | undefined) {
        do { // iterate as linked list until we find the first labeled statement
            if (wrap.kind === ts.SyntaxKind.LabeledStatement) {
                this.visitNode(wrap); // to handle this label we need to recursively call visitNode
                wrap = wrap.skip!; // continue right after the labeled statement
            } else {
                wrap = wrap.next!;
            }
        } while (wrap !== end);
    }

    private visitNode(wrap: NodeWrap): void {
        const {node} = wrap;
        if (isLabeledStatement(node)) {
            this.labels.unshift({node, name: node.label.text, used: false});
            this.visitNode(wrap.children[1]);
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
        if (isFunctionScopeBoundary(node)) {
            const saved = this.labels;
            this.labels = [];
            // can iterate as linked list again since there are no active labels to look for
            this.iterate(wrap.next!, wrap.skip);
            this.labels = saved;
            return;
        }
        return wrap.children.forEach(this.visitNode, this);
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
