import { excludeDeclarationFiles, TypedRule, requiresCompilerOption } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isDeleteExpression,
    isElementAccessExpression,
} from 'tsutils';
import * as ts from 'typescript';
import { elementAccessSymbols } from '../utils';

@excludeDeclarationFiles
@requiresCompilerOption('strictNullChecks')
export class Rule extends TypedRule {
    public apply() {
        const re = /\bdelete\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (!isDeleteExpression(node) || node.expression.pos !== re.lastIndex)
                continue;
            const {expression} = node;
            if (isElementAccessExpression(expression)) {
                for (const {symbol, name} of elementAccessSymbols(expression, this.checker))
                    this.checkSymbol(symbol, node, name);
            } else {
                this.checkSymbol(this.checker.getSymbolAtLocation(expression), node);
            }
        }
    }

    private checkSymbol(symbol: ts.Symbol | undefined, errorNode: ts.Node, name?: string) {
        if (symbol === undefined || symbol.flags & ts.SymbolFlags.Optional)
            return;
        this.addFailureAtNode(errorNode, `Only 'delete' optional properties. Property '${name || symbol.name}' is required.`);
    }
}
