import { excludeDeclarationFiles, AbstractRule, Replacement } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition, isExpressionStatement, isStringLiteral } from 'tsutils';
import * as ts from 'typescript';
import { hasDirectivePrologue, isStrictFlagEnabled } from '../utils';

const enum Reason {
    Antedecent = "there is already a 'use strict' directive in this prologue",
    Class = 'classes are always in strict mode',
    Module = 'ES6 modules are always in strict mode',
    Option = "due to the compilerOption 'alwaysStrict' this code is in strict mode",
    Parent = 'a parent node is already in strict mode',
}

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    private strictFile = this.program !== undefined && isStrictFlagEnabled(this.program.getCompilerOptions(), 'alwaysStrict')
        ? Reason.Option
        : ts.isExternalModule(this.sourceFile)
            ? Reason.Module
            : undefined;

    public apply() {
        const re = /(['"])use strict\1/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (
                node.end === re.lastIndex &&
                isStringLiteral(node) &&
                node.text === 'use strict' &&
                node.parent!.kind === ts.SyntaxKind.ExpressionStatement
            )
                this.checkUseStrictDirective(<ts.ExpressionStatement>node.parent);
        }
    }

    private checkUseStrictDirective(directive: ts.ExpressionStatement) {
        const parent = directive.parent!;
        if (!hasDirectivePrologue(parent))
            return; // not a directive
        let reason = this.strictFile;
        for (const statement of parent.statements) {
            if (statement === directive) {
                if (reason === undefined && parent.kind !== ts.SyntaxKind.SourceFile)
                    reason = this.isInStrictContext(parent.parent!.parent!) ||
                        (this.hasUseStrictDirective(this.sourceFile) ? Reason.Parent : undefined);

                if (reason !== undefined)
                    this.addFailureAtNode(
                        directive,
                        `Redundant 'use strict': ${reason}.`,
                        Replacement.delete(directive.pos, directive.end),
                    );
                return;
            }
            if (!isExpressionStatement(statement) || !isStringLiteral(statement.expression))
                return; // not a directive
            if (reason === undefined && statement.expression.getText(this.sourceFile).slice(1, -1) === 'use strict')
                reason = Reason.Antedecent;
        }
    }

    private isInStrictContext(node: ts.Node): Reason | undefined {
        while (true) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                    return Reason.Class;
                case ts.SyntaxKind.SourceFile:
                    return; // SourceFile was already checked
            }
            if (hasDirectivePrologue(node)) {
                if (this.hasUseStrictDirective(node))
                    return Reason.Parent;
                node = node.parent!.parent!;
            } else {
                node = node.parent!;
            }
        }
    }

    private hasUseStrictDirective(node: ts.BlockLike) {
        for (const statement of node.statements) {
            if (!isExpressionStatement(statement) || !isStringLiteral(statement.expression))
                break;
            if (statement.expression.getText(this.sourceFile).slice(1, -1) === 'use strict')
                return true;
        }
        return false;
    }
}
