import { ConfigurableRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    collectVariableUsage,
    isVariableDeclaration,
    getVariableDeclarationKind,
    VariableDeclarationKind,
    VariableUse,
    UsageDomain,
    isReassignmentTarget,
    isBindingElement,
    getDeclarationOfBindingElement,
    isScopeBoundary,
    isFunctionScopeBoundary,
} from 'tsutils';

export interface Options {
    destructuring: 'all' | 'any';
}

export class Rule extends ConfigurableRule<Options> {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    protected parseOptions(options: {destructuring?: string} | null | undefined): Options {
        let destructuring: Options['destructuring'] = 'all';
        if (options != undefined && 'destructuring' in options && options.destructuring === 'any')
            destructuring = 'any';
        return {
            destructuring,
        };
    }

    public apply() {
        interface ListInfo {
            fixable: boolean;
            declarations: ts.Identifier[];
        }
        const listInfo = new Map<ts.VariableDeclarationList, ListInfo>();
        for (const [name, variableInfo] of collectVariableUsage(this.sourceFile)) {
            if (variableInfo.inGlobalScope || variableInfo.exported)
                continue;
            for (const d of variableInfo.declarations) {
                let declaration = d.parent!;
                if (isBindingElement(declaration))
                    declaration = getDeclarationOfBindingElement(declaration);
                if (!isVariableDeclaration(declaration))
                    continue;
                const parent = declaration.parent!;
                if (parent.kind !== ts.SyntaxKind.VariableDeclarationList)
                    continue;
                const kind = getVariableDeclarationKind(parent);
                if (kind === VariableDeclarationKind.Const)
                    continue;
                const canBeConst = variableInfo.declarations.length === 1 &&
                    declaration.initializer !== undefined &&
                    variableInfo.uses.every(noReassignment) &&
                    (kind === VariableDeclarationKind.Let || !usedInOuterScopeOrTdz(name, variableInfo.uses));
                let list = listInfo.get(parent);
                if (list === undefined) {
                    list = {
                        fixable: canBeConst,
                        declarations: [],
                    };
                    listInfo.set(parent, list);
                }
                if (canBeConst) {
                    list.declarations.push(name);
                } else {
                    list.fixable = false;
                }
            }
        }
        for (const [list, meta] of listInfo) {
            let fix: Replacement | undefined;
            if (meta.fixable) {
                fix = Replacement.replace(list.declarations.pos - 3, list.declarations.pos, 'const');
            } else if (this.options.destructuring === 'all' || isForLoop(list.parent!)) {
                continue;
            }
            const keyword = this.sourceFile.text.substr(list.declarations.pos - 3, 3);
            for (const name of meta.declarations)
                this.addFailureAtNode(name, `Variable '${name.text}' is never reassigned. Prefer 'const' instead of '${keyword}'.`, fix);
        }
    }
}

function getScopeBoundary(node: ts.Node) {
    do
        node = node.parent!;
    while (!isScopeBoundary(node));
    return node;
}

function getFunctionScopeBoundary(node: ts.Node) {
    while (!isFunctionScopeBoundary(node))
        node = node.parent!;
    return node;
}

function usedInOuterScopeOrTdz(declaration: ts.Node, uses: VariableUse[]) {
    const declaredScope = getScopeBoundary(declaration);
    const functionScope = getFunctionScopeBoundary(declaredScope);
    for (const use of uses) {
        // TODO detect uses in intializer (for BindingElement all initializers up to declaration root)
        if (use.domain === UsageDomain.Value && use.location.pos < declaration.pos)
            return true; // (maybe) used before declaration
        const useScope = getScopeBoundary(use.location.parent!);
        if (useScope.pos < declaredScope.pos)
            return true;
        if (use.domain === UsageDomain.Value && getFunctionScopeBoundary(useScope) !== functionScope)
            return true; // maybe used before declaration
    }
    return false;
}

function noReassignment(use: VariableUse) {
    return use.domain !== UsageDomain.Value || !isReassignmentTarget(use.location);
}

function isForLoop(node: ts.Statement) {
    return node.kind === ts.SyntaxKind.ForStatement || node.kind === ts.SyntaxKind.ForOfStatement;
}
