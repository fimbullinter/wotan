import { AbstractRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { WrappedAst, getWrappedNodeAtPosition } from 'tsutils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        let wrappedAst: WrappedAst | undefined;
        const {text} = this.sourceFile;
        const re = /\bnew\b/g;

        for (let match = re.exec(text); match !== null; match = re.exec(text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst ??= this.context.getWrappedAst(), match.index)!;
            if (node.kind === ts.SyntaxKind.NewExpression &&
                text[node.end - 1] !== ')' &&
                re.lastIndex === (<ts.NewExpression>node).expression.pos)
                this.addFinding(node.end, node.end, 'Expected parentheses on constructor call.', Replacement.append(node.end, '()'));
        }
    }
}
