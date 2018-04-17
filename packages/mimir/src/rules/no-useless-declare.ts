import { excludeDeclarationFiles, typescriptOnly, AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { hasModifier, getModifier, getNextToken } from 'tsutils';

@excludeDeclarationFiles
@typescriptOnly
export class Rule extends AbstractRule {
    public apply() {
        this.checkStatements(this.sourceFile);
    }

    private checkStatements(block: ts.BlockLike) {
        for (const statement of block.statements) {
            if (shouldCheck(statement)) {
                const declareKeyword = getModifier(statement, ts.SyntaxKind.DeclareKeyword);
                if (declareKeyword !== undefined) {
                    const start = declareKeyword.getStart(this.sourceFile);
                    this.addFailure(
                        start,
                        declareKeyword.end,
                        "Using the 'declare' keyword here is redundant as the statement has no runtime value.",
                        Replacement.delete(start, getNextToken(declareKeyword)!.getStart(this.sourceFile)),
                    );
                }
            } else if (statement.kind === ts.SyntaxKind.ModuleDeclaration) {
                this.checkModule(<ts.ModuleDeclaration>statement);
            }
        }
    }

    private checkModule(node: ts.ModuleDeclaration): void {
        if (node.body === undefined || hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword))
            return;
        if (node.body.kind === ts.SyntaxKind.ModuleDeclaration)
            return this.checkModule(node.body);
        if (node.body.kind === ts.SyntaxKind.ModuleBlock)
            return this.checkStatements(node.body);
    }
}

function shouldCheck(node: ts.Statement): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
            return true;
        case ts.SyntaxKind.EnumDeclaration:
            return hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword);
        default:
            return false;
    }
}
