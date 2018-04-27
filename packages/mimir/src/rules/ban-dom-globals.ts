import { TypedRule, requireLibraryFile } from '@fimbul/ymir';
import * as ts from 'typescript';
import { getUsageDomain, UsageDomain, isSourceFile } from 'tsutils';
import * as path from 'path';

@requireLibraryFile('lib.dom.d.ts')
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (node.kind !== ts.SyntaxKind.Identifier)
                continue;
            const text = (<ts.Identifier>node).text;
            if (isWhitelisted(text) || (getUsageDomain(<ts.Identifier>node)! & UsageDomain.Value) === 0)
                continue;
            const symbol = this.checker.getSymbolAtLocation(node);
            if (
                symbol !== undefined &&
                symbol.valueDeclaration !== undefined &&
                symbol.flags & (ts.SymbolFlags.Variable | ts.SymbolFlags.Function) &&
                isDeclarationInLibDom(symbol.valueDeclaration)
            )
                this.addFailureAtNode(
                    node,
                    `Referencing global '${text}' is not allowed. Did you mean to use a local variable or parameter with a similar name?`,
                );
        }
    }
}

function isDeclarationInLibDom(node: ts.Node): boolean {
    if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
        node = node.parent!;
    } else if (node.kind === ts.SyntaxKind.VariableDeclaration) {
        node = node.parent!.parent!;
        if (node.kind !== ts.SyntaxKind.VariableStatement)
            return false;
        node = node.parent!;
    } else {
        return false;
    }
    return isSourceFile(node) && path.basename(node.fileName) === 'lib.dom.d.ts';
}

function isWhitelisted(name: string): boolean {
    // exclude all identifiers that start with an uppercase letter to allow `new Event()` and stuff
    if (name.charAt(0) === name.charAt(0).toUpperCase())
        return true;
    switch (name) {
        case 'document':
        case 'window':
        case 'navigator':
        case 'alert':
        case 'confirm':
        case 'prompt':
        case 'atob':
        case 'btoa':
        case 'console':
        case 'sessionStorage':
        case 'localStorage':
        case 'indexedDB':
            return true;
        default:
            return /^(?:(?:set|clear)(?:Timeout|Interval|Immediate)|(?:request|cancel)AnimationFrame)$/.test(name);
    }
}
