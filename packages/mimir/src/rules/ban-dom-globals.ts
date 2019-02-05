import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { getUsageDomain, UsageDomain, isSourceFile, isInterfaceDeclaration } from 'tsutils';
import * as path from 'path';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    private window: ts.Type | undefined = undefined;

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
                this.isDomGlobal(symbol.valueDeclaration, text)
            )
                this.addFindingAtNode(
                    node,
                    `Referencing global '${text}' is not allowed. Did you mean to use a local variable or parameter with a similar name?`,
                );
        }
    }

    private isDomGlobal(declaration: ts.Node, name: string): boolean {
        const sourceFile = getLibFile(declaration);
        return sourceFile !== undefined && this.isWindowProperty(sourceFile, name);
    }

    private isWindowProperty(sourceFile: ts.SourceFile, name: string): boolean {
        if (this.window === undefined) {
            const declaration =
                sourceFile.statements.find((d): d is ts.InterfaceDeclaration => isInterfaceDeclaration(d) && d.name.text === 'Window')!;
            this.window = this.checker.getDeclaredTypeOfSymbol(this.checker.getSymbolAtLocation(declaration.name)!);
        }
        return this.window.getProperty(name) !== undefined;
    }
}

function getLibFile(node: ts.Node): ts.SourceFile | undefined {
    if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
        node = node.parent!;
    } else if (node.kind === ts.SyntaxKind.VariableDeclaration) {
        node = node.parent!.parent!;
        if (node.kind !== ts.SyntaxKind.VariableStatement)
            return;
        node = node.parent!;
    } else {
        return;
    }
    return isSourceFile(node) && /^lib(?:\.dom)?\.d\.ts$/.test(path.basename(node.fileName)) ? node : undefined;
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
        case 'fetch':
        case 'console':
        case 'sessionStorage':
        case 'localStorage':
        case 'indexedDB':
            return true;
        default:
            return /^(?:(?:set|clear)(?:Timeout|Interval|Immediate)|(?:request|cancel)AnimationFrame)$/.test(name);
    }
}
