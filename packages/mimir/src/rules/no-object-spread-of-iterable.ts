import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isReassignmentTarget,
} from 'tsutils';
import { isExpressionIterable } from '../iteration';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        const re = /\.{3}/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst ??= this.context.getWrappedAst(), re.lastIndex)!;
            if (node.pos !== re.lastIndex)
                continue;
            switch (node.parent!.kind) {
                case ts.SyntaxKind.SpreadAssignment:
                    if (isReassignmentTarget(<ts.ObjectLiteralExpression>node.parent.parent))
                        continue;
                    // falls through
                case ts.SyntaxKind.JsxSpreadAttribute:
                    this.checkObjectSpread(<ts.Expression>node);
            }
        }
    }

    private checkObjectSpread(node: ts.Expression) {
        if (isExpressionIterable(node, this.checker, this.context.compilerOptions, false))
            this.addFindingAtNode(node, 'Spreading an Iterable type into an object is most likely a mistake. Did you intend to use array spread instead?');
    }
}
