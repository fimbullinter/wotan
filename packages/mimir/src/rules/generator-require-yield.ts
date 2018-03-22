import * as ts from 'typescript';
import { isFunctionScopeBoundary, NodeWrap } from 'tsutils';
import { AbstractRule, excludeDeclarationFiles } from '@fimbul/ymir';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    private containsYield = false;

    public apply() {
        return this.iterate(this.context.getWrappedAst().next, undefined);
    }

    private iterate(wrap: NodeWrap, end: NodeWrap | undefined) {
        do { // iterate as linked list until we find a generator
            if (wrap.kind === ts.SyntaxKind.Block && isGenerator(wrap.node.parent)) {
                this.containsYield = false;
                wrap.children.forEach(this.visitNode, this); // walk the function body recursively
                if (this.shouldFail()) // call as method so CFA doesn't infer `this.containsYield` as always false
                    this.fail(wrap.node.parent);
                wrap = wrap.skip!; // continue right after the function body
            } else {
                wrap = wrap.next!;
            }
        } while (wrap !== end);
    }

    private visitNode(wrap: NodeWrap): void {
        if (wrap.node.kind === ts.SyntaxKind.YieldExpression) {
            this.containsYield = true;
            if (wrap.children.length === 0)
                return;
            return this.visitNode(wrap.children[0]);
        }
        if (isFunctionScopeBoundary(wrap.node)) {
            const saved = this.containsYield;
            // can iterate as linked list again for nested functions
            this.iterate(wrap.next!, wrap.skip);
            this.containsYield = saved;
            return;
        }
        return wrap.children.forEach(this.visitNode, this);
    }

    private shouldFail() {
        return !this.containsYield;
    }

    private fail({asteriskToken, name}: GeneratorDeclaration) {
        this.addFailure(
            asteriskToken.end - 1,
            asteriskToken.end,
            `Generator ${name === undefined ? '' : `'${name.getText(this.sourceFile).replace(/'/g, "\\'")}' `}contains no 'yield'.`,
        );
    }
}

type GeneratorDeclaration = ts.FunctionLikeDeclaration & {asteriskToken: ts.AsteriskToken};

function isGenerator(node: ts.Node | undefined): node is GeneratorDeclaration {
    switch (node!.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.MethodDeclaration:
            return (<ts.FunctionLikeDeclaration>node).asteriskToken !== undefined;
        default:
            return false;
    }
}
