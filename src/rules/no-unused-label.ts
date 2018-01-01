import * as ts from 'typescript';
import { isLabeledStatement, isIterationStatement, isBreakOrContinueStatement, isFunctionScopeBoundary, NodeWrap } from 'tsutils';
import { AbstractRule, Replacement, RuleContext, WrappedAst } from '../types';
import bind from 'bind-decorator';
import { injectable } from 'inversify';

interface Label {
    node: ts.LabeledStatement;
    name: string;
    used: boolean;
}

@injectable()
export class Rule extends AbstractRule {
    private labels: Label[] = [];

    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    constructor(context: RuleContext, private ast: WrappedAst) {
        super(context);
    }

    public apply() {
        return this.ast.children.forEach(this.visitNode, this);
    }

    @bind
    private visitNode(wrap: NodeWrap): void {
        const {node} = wrap;
        if (isLabeledStatement(node)) {
            if (!isIterationStatement(node.statement) && node.statement.kind !== ts.SyntaxKind.SwitchStatement) {
                this.fail(node);
                return this.visitNode(wrap.children[1]);
            }
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
        if (this.labels.length !== 0 && isFunctionScopeBoundary(node)) {
            const saved = this.labels;
            this.labels = [];
            wrap.children.forEach(this.visitNode, this);
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
