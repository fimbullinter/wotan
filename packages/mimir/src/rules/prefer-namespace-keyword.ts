import { typescriptOnly, AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import { getChildOfKind } from 'tsutils';

@typescriptOnly
export class Rule extends AbstractRule {
    public apply() {
        return this.checkStatements(this.sourceFile);
    }

    private checkStatements(block: ts.BlockLike) {
        for (const statement of block.statements) {
            if (statement.kind !== ts.SyntaxKind.ModuleDeclaration)
                continue;
            if (
                (statement.flags & (ts.NodeFlags.Namespace | ts.NodeFlags.GlobalAugmentation)) === 0 &&
                (<ts.ModuleDeclaration>statement).name.kind === ts.SyntaxKind.Identifier
            ) {
                const keyword = getChildOfKind(statement, ts.SyntaxKind.ModuleKeyword, this.sourceFile)!;
                this.addFailure(
                    keyword.end - 'module'.length,
                    keyword.end,
                    "Prefer 'namespace' over 'module'.",
                    Replacement.replace(keyword.end - 'module'.length, keyword.end, 'namespace'),
                );
            }
            this.checkModule(<ts.ModuleDeclaration>statement);
        }
    }

    private checkModule(node: ts.ModuleDeclaration): void {
        if (node.body === undefined)
            return;
        if (node.body.kind === ts.SyntaxKind.ModuleDeclaration)
            return this.checkModule(node.body);
        return this.checkStatements(<ts.ModuleBlock>node.body);
    }
}
