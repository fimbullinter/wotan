import { typescriptOnly, AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { hasModifier, getModifier, getNextToken } from 'tsutils';

@typescriptOnly
export class Rule extends AbstractRule {
    public apply() {
        return this.checkStatements(this.sourceFile);
    }

    private checkStatements(block: ts.BlockLike) {
        for (const statement of block.statements) {
            if (this.shouldCheck(statement)) {
                const declareKeyword = getModifier(statement, ts.SyntaxKind.DeclareKeyword);
                if (declareKeyword !== undefined) {
                    const start = declareKeyword.end - 'declare'.length;
                    this.addFinding(
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
        return this.checkStatements(<ts.ModuleBlock>node.body);
    }

    private shouldCheck(node: ts.Statement): boolean {
        switch (node.kind) {
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
                return true;
            case ts.SyntaxKind.EnumDeclaration:
                // allow 'declare const enum' in declaration files, because it's required in declaration files
                return !this.sourceFile.isDeclarationFile && hasModifier(node.modifiers, ts.SyntaxKind.ConstKeyword);
            default:
                return this.sourceFile.isDeclarationFile && hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword);
        }
    }
}
