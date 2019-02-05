import { typescriptOnly, AbstractRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';

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
                const end = (<ts.ModuleDeclaration>statement).name.pos;
                const start = end - 'module'.length;
                this.addFinding(start, end, "Prefer 'namespace' over 'module'.", Replacement.replace(start, end, 'namespace'));
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
