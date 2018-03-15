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
        if (options != undefined && options.destructuring === 'any')
            destructuring = 'any';
        return {
            destructuring,
        };
    }

    public apply() {
        interface ListInfo {
            fixable: boolean;
            declarations: DeclarationInfo[];
        }
        interface DeclarationInfo {
            identifiers: ts.Identifier[];
            fixable: boolean;
        }
        const declarationInfo = new Map<ts.VariableDeclaration, DeclarationInfo>();
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
                    (declaration.initializer !== undefined || isForInOrOfStatement(parent.parent!)) &&
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
                let decl = declarationInfo.get(declaration);
                if (decl === undefined) {
                    decl = {
                        identifiers: [],
                        fixable: canBeConst,
                    };
                    list.declarations.push(decl);
                }
                if (canBeConst) {
                    decl.identifiers.push(name);
                } else {
                    decl.fixable = false;
                    list.fixable = false;
                }
            }
        }
        for (const [list, listMeta] of listInfo) {
            let fix: Replacement | undefined;
            if (listMeta.fixable) {
                fix = Replacement.replace(list.declarations.pos - 3, list.declarations.pos, 'const');
            } else if (list.parent!.kind === ts.SyntaxKind.ForStatement) {
                continue;
            }
            const keyword = this.sourceFile.text.substr(list.declarations.pos - 3, 3);
            for (const declaration of listMeta.declarations) {
                if (declaration.identifiers.length === 0 || !declaration.fixable && this.options.destructuring === 'all')
                    continue;
                for (const name of declaration.identifiers)
                    this.addFailureAtNode(
                        name,
                        `Variable '${name.text}' is never reassigned. Prefer 'const' instead of '${keyword}'.`,
                        fix,
                    );
            }
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
        // TODO used in for-of or for-in expression
        const valueUse = (use.domain & (UsageDomain.Value | UsageDomain.TypeQuery)) === UsageDomain.Value;
        if (valueUse && use.location.pos < declaration.pos)
            return true; // (maybe) used before declaration
        const useScope = getScopeBoundary(use.location.parent!);
        if (useScope.pos < declaredScope.pos)
            return true;
        if (valueUse && getFunctionScopeBoundary(useScope) !== functionScope)
            return true; // maybe used before declaration
    }
    return false;
}

function isForInOrOfStatement(node: ts.Node) {
    return node.kind === ts.SyntaxKind.ForOfStatement || node.kind === ts.SyntaxKind.ForInStatement;
}

function noReassignment(use: VariableUse) {
    return (use.domain & UsageDomain.Value) === 0 || !isReassignmentTarget(use.location);
}
