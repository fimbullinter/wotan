import { AbstractRule, excludeDeclarationFiles } from '@fimbul/ymir';
import {
    isVariableStatement,
    hasModifier,
    getVariableDeclarationKind,
    VariableDeclarationKind,
    VariableInfo,
    collectVariableUsage,
} from 'tsutils';
import * as ts from 'typescript';
import { isVariableReassignment } from '../utils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    private usage: Map<ts.Identifier, VariableInfo> | undefined = undefined;

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (
                !isVariableStatement(node) ||
                getVariableDeclarationKind(node.declarationList) === VariableDeclarationKind.Const ||
                hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword) ||
                isAmbientVariableStatement(node)
            )
                continue;
            for (const declaration of node.declarationList.declarations)
                if (declaration.name.kind === ts.SyntaxKind.Identifier && declaration.initializer === undefined)
                    this.checkDeclaration(declaration.name);
        }
    }

    private checkDeclaration(node: ts.Identifier) {
        if (this.usage === undefined)
            this.usage = collectVariableUsage(this.sourceFile);
        const variableInfo = this.usage.get(node)!;
        if (!variableInfo.inGlobalScope && !variableInfo.exported && !variableInfo.uses.some(isVariableReassignment))
            this.addFailureAtNode(node, `Variable '${node.text}' is never assigned.`);
    }
}

function isAmbientVariableStatement(node: ts.VariableStatement): boolean {
    return hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword) ||
        node.parent!.kind === ts.SyntaxKind.ModuleBlock && isAmbientModuleDeclaration(<ts.ModuleDeclaration>node.parent!.parent);
}

function isAmbientModuleDeclaration(node: ts.ModuleDeclaration): boolean {
    while (node.flags & ts.NodeFlags.NestedNamespace)
        node = <ts.ModuleDeclaration>node.parent;
    if (hasModifier(node.modifiers, ts.SyntaxKind.DeclareKeyword))
        return true;
    return node.parent!.kind === ts.SyntaxKind.ModuleDeclaration && isAmbientModuleDeclaration(<ts.ModuleDeclaration>node.parent);
}
