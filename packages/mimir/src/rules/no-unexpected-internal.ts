import { excludeDeclarationFiles, requiresCompilerOption, TypedRule } from '@fimbul/ymir';
import { WrappedAst, getWrappedNodeAtPosition } from 'tsutils';
import * as ts from 'typescript';

@excludeDeclarationFiles
@requiresCompilerOption('stripInternal')
export class Rule extends TypedRule {
    public apply() {
        const re = /@internal/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            // TODO don't parse into JSX
            if (ts.forEachLeadingCommentRange(this.sourceFile.text, node.pos, isLeadingCommentAtPosition, match.index)) {
                // TODO exclude nodes where `//@internal` has no effect
                // TODO check if comment only contains @internal
                this.addFailure(match.index, re.lastIndex, "Possibly unintented use of '@internal' in comment.");
            }
        }
    }
}

interface NodeAndComment {
    node: ts.Node;
    comment: ts.CommentRange;
}

function getNodeAndInternalComment(block: ts.SourceFile | ts.ModuleBlock, position: number, sourceFile: ts.SourceFile): NodeAndComment | undefined {
    for (const statement of block.statements) {
        if (statement.pos > position)
            return;
        if (statement.end > position && canStatementBeInternal(statement))
            return getInternalComment(statement, position, sourceFile) ||
                getInternalDeclarationPart(statement, position, sourceFile);
    }
    return;
}

type PossiblyInternalStatement =
    | ts.VariableStatement
    | ts.ClassDeclaration
    | ts.FunctionDeclaration
    | ts.ModuleDeclaration
    | ts.TypeAliasDeclaration
    | ts.InterfaceDeclaration
    | ts.EnumDeclaration
    | ts.ImportDeclaration
    | ts.ImportEqualsDeclaration
    | ts.ExportDeclaration;

function canStatementBeInternal(node: ts.Statement): node is PossiblyInternalStatement {
    switch (node.kind) {
        case ts.SyntaxKind.VariableStatement:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.ModuleDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.ImportDeclaration:
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.ExportDeclaration:
            return true;
        default:
            return false;
    }
}

function getInternalComment(node: ts.Node, position: number, sourceFile: ts.SourceFile) {
    return ts.forEachLeadingCommentRange(sourceFile.text, node.pos, (pos, end, kind): NodeAndComment | undefined => {
        return pos < position && position < end
            ? {
                node,
                comment: {
                    pos,
                    end,
                    kind,
                },
            }
            : undefined;
    });
}

interface ReadonlyArray<T> extends Iterable<T> {
    readonly [key: number]: T;
    readonly length: number;
}

function getInternalDeclarationPart(node: PossiblyInternalStatement, position: number, sourceFile: ts.SourceFile): NodeAndComment | undefined {
    switch (node.kind) {
        case ts.SyntaxKind.ModuleDeclaration:
            if (node.body === undefined)
                return;
            switch (node.body.kind) {
                case ts.SyntaxKind.ModuleBlock:
                    return getNodeAndInternalComment(node.body, position, sourceFile);
                case ts.SyntaxKind.ModuleDeclaration:
                    return getInternalComment(node.body, position, sourceFile) ||
                        getInternalDeclarationPart(node.body, position, sourceFile);
                default:
                    return;
            }
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
            return firstDefined(node.heritageClauses, (clause) => firstDefined(clause.types, (t) => getInternalComment(t, position, sourceFile))) ||
                firstDefined(node.members, (m: ts.Node) => getInternalComment(m, position, sourceFile));
        case ts.SyntaxKind.EnumDeclaration:
            return firstDefined(node.members, (m) => getInternalComment(m, position, sourceFile));
        case ts.SyntaxKind.VariableStatement:
            return firstDefined(node.declarationList.declarations, (m) => getInternalComment(m, position, sourceFile));
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.ImportEqualsDeclaration:
            return;
        case ts.SyntaxKind.ImportDeclaration:
            return node.importClause && (
                node.importClause.name && getInternalComment(node.importClause.name, position, sourceFile) ||
                node.importClause.namedBindings && (
                    node.importClause.namedBindings.kind === ts.SyntaxKind.NamespaceImport
                        ? getInternalComment(node.importClause.namedBindings.name, position, sourceFile)
                        : firstDefined(node.importClause.namedBindings.elements, (e) => getInternalComment(e, position, sourceFile))
                )
            );
    }
}

function firstDefined<T extends ts.Node, U>(nodes: ReadonlyArray<T> | undefined, cb: (node: T) => U | undefined): U | undefined {
    if (nodes !== undefined) {
        for (const node of nodes) {
            const result = cb(node);
            if (result !== undefined)
                return result;
        }
    }
    return;
}

function isLeadingCommentAtPosition(start: number, end: number, _kind: ts.CommentKind, _newline: boolean, position: number): boolean {
    return start < position && position < end;
}
