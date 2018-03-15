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
                    declarationInfo.set(declaration, decl);
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
    const deadZones: ts.TextRange[] = [{pos: 0, end: declaration.pos}];
    declaration = declaration.parent!;
    while (isBindingElement(declaration)) {
        if (declaration.initializer !== undefined)
            deadZones.push({pos: declaration.initializer.pos, end: declaration.initializer.end});
        declaration = declaration.parent!.parent!;
    }
    const varDeclaration = <ts.VariableDeclaration>declaration;
    if (varDeclaration.initializer !== undefined) {
        deadZones.push({pos: varDeclaration.initializer.pos, end: varDeclaration.initializer.end});
    } else {
        deadZones.push({
            pos: (<ts.ForInOrOfStatement>varDeclaration.parent!.parent).expression.pos,
            end: (<ts.ForInOrOfStatement>varDeclaration.parent!.parent).expression.end},
        );
    }
    const declaredScope = getScopeBoundary(declaration.parent!);
    const functionScope = getFunctionScopeBoundary(declaredScope);
    for (const use of uses) {
        const useScope = getScopeBoundary(use.location.parent!);
        if (useScope.pos < declaredScope.pos || useScope.end > declaredScope.end)
            return true;
        if ((use.domain & (UsageDomain.Value | UsageDomain.TypeQuery)) === UsageDomain.Value) {
            if (getFunctionScopeBoundary(useScope) !== functionScope)
                return true; // maybe used before declaration
            for (const deadZone of deadZones)
                if (use.location.pos >= deadZone.pos && use.location.pos < deadZone.end)
                    return true; // used in temporal dead zone
        }
    }
    return false;
}

function isForInOrOfStatement(node: ts.Node): node is ts.ForOfStatement | ts.ForInStatement {
    return node.kind === ts.SyntaxKind.ForOfStatement || node.kind === ts.SyntaxKind.ForInStatement;
}

function noReassignment(use: VariableUse) {
    return (use.domain & UsageDomain.Value) === 0 || !isReassignmentTarget(use.location);
}
