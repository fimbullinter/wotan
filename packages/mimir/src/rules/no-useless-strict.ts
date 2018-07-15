import { excludeDeclarationFiles, AbstractRule } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition, isExpressionStatement, isStringLiteral } from 'tsutils';
import * as ts from 'typescript';
import { hasDirectivePrologue } from '../utils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        const re = /(['"])use strict\1/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (
                node.kind === ts.SyntaxKind.StringLiteral &&
                node.end === re.lastIndex &&
                node.parent!.kind === ts.SyntaxKind.ExpressionStatement
            )
                this.checkUseStrictDirective(<ts.ExpressionStatement>node.parent);
        }
    }

    private checkUseStrictDirective(directive: ts.ExpressionStatement) {
        const parent = directive.parent!;
        if (!hasDirectivePrologue(parent))
            return; // not a directive
        for (const statement of parent.statements) {
            if (statement === directive) {
                if (
                    this.isAlwaysStrict() ||
                    ts.isExternalModule(this.sourceFile) ||
                    parent.kind !== ts.SyntaxKind.SourceFile && (
                        this.hasUseStrictDirective(this.sourceFile) ||
                        this.isInStrictContext(parent.parent!.parent!)
                    )
                )
                    this.addFailureAtNode(directive, "Redundant 'use strict'");
                return;
            }
            if (!isExpressionStatement(statement) || !isStringLiteral(statement.expression))
                return; // not a directive
            if (statement.expression.getText(this.sourceFile).slice(1, -1) === 'use strict')
                return this.addFailureAtNode(directive, "Redundant 'use strict'");
        }
    }

    private isInStrictContext(node: ts.Node): boolean {
        while (true) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                    return true;
                case ts.SyntaxKind.SourceFile:
                    return false; // SourceFile was already checked
            }
            if (hasDirectivePrologue(node)) {
                if (this.hasUseStrictDirective(node))
                    return true;
                node = node.parent!.parent!;
            } else {
                node = node.parent!;
            }
        }
    }

    private isAlwaysStrict(): boolean {
        if (this.program === undefined)
            return false;
        const compilerOptions = this.program.getCompilerOptions();
        return compilerOptions.strict ? compilerOptions.alwaysStrict !== false : compilerOptions.alwaysStrict === true;
    }

    private hasUseStrictDirective(node: ts.BlockLike) {
        for (const statement of node.statements) {
            if (!isExpressionStatement(statement) || !isStringLiteral(statement.expression))
                return false;
            if (statement.expression.getText(this.sourceFile).slice(1, -1) === 'use strict')
                return true;
        }
        return false;
    }
}
