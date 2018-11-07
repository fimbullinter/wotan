import * as ts from 'typescript';
import { typescriptOnly, AbstractRule, Replacement } from '@fimbul/ymir';
import { WrappedAst, isTypeNodeKind, getWrappedNodeAtPosition, getCommentAtPosition, getTokenAtPosition } from 'tsutils';
import { commentText } from '../utils';

@typescriptOnly
export class Rule extends AbstractRule {
    public apply() {
        const internalRanges: ts.TextRange[] = [];
        const re = /@internal/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            const token = getTokenAtPosition(node, match.index)!;
            const comment = getCommentAtPosition(this.sourceFile, match.index, token);
            if (comment === undefined)
                continue;
            if (this.sourceFile.isDeclarationFile) {
                this.fail(match.index, "'@internal' comments have no effect in declaration files.", token, comment);
                continue;
            }
            // if (this.program !== undefined && !isCompilerOptionEnabled(this.program.getCompilerOptions(), 'stripInternal')) {
            //     this.addFailure(
            //         match.index,
            //         match[0].length,
            //         "'@internal' comments only have an effect if you enable 'declaration' and 'stripInternal' compiler options.",
            //     );
            //     continue;
            // }
            let isLeadingComment = false;
            ts.forEachLeadingCommentRange(this.sourceFile.text, token.pos, (pos) => {
                isLeadingComment = match!.index > pos;
                return true;
            });
            if (!isLeadingComment) {
                this.fail(match.index, "'@internal' needs to a be in a leading comment, currently it's a trailing comment.");
                continue;
            }
            const maybeInternalNode = getTopmostNodeAtPosition(node);
            if (!canNodeBeInternal(maybeInternalNode)) {
                this.fail(match.index, "'@internal' has no effect on this node.", token, comment);
                continue;
            }
            if (positionIsContainedInRanges(internalRanges, match.index)) {
                this.fail(match.index, "'@internal' is redundant as a parent declaration is already internal", token, comment);
                continue;
            }
            internalRanges.push(maybeInternalNode);
        }
    }

    private fail(start: number, message: string, token: ts.Node, comment: ts.CommentRange): void;
    private fail(start: number, message: string): void;
    private fail(start: number, message: string, token?: ts.Node, comment?: ts.CommentRange) {
        let fix;
        if (comment !== undefined && commentText(this.sourceFile.text, comment).trim() === '@internal') {
            const fixEnd = ts.forEachLeadingCommentRange(this.sourceFile.text, token!.pos, (pos) => pos > start ? pos : undefined) ||
                token!.getStart(this.sourceFile);
            fix = Replacement.delete(comment.pos, fixEnd);
        }
        this.addFailure(start, start + '@internal'.length, message, fix);
    }
}

function positionIsContainedInRanges(ranges: ts.TextRange[], pos: number): boolean {
    for (const range of ranges)
        if (range.pos < pos && pos < range.end)
            return true;
    return false;
}

function getTopmostNodeAtPosition(node: ts.Node) {
    while (node.parent.pos === node.pos && node.parent.kind !== ts.SyntaxKind.SourceFile)
        node = node.parent!;
    return node;
}

function canNodeBeInternal(node: ts.Node): boolean {
    switch (node.kind) {
        case ts.SyntaxKind.ExportDeclaration:
        case ts.SyntaxKind.ExportAssignment:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.ImportDeclaration:
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.VariableStatement:
        case ts.SyntaxKind.VariableDeclaration:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.EnumMember:
        case ts.SyntaxKind.ModuleDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.MethodSignature:
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.PropertySignature:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.Constructor:
        case ts.SyntaxKind.CallSignature:
        case ts.SyntaxKind.ConstructSignature:
        case ts.SyntaxKind.TypeParameter:
        case ts.SyntaxKind.ExpressionWithTypeArguments:
            return true;
        // TODO verify
        case ts.SyntaxKind.ExportSpecifier:
        case ts.SyntaxKind.ImportSpecifier:
        case ts.SyntaxKind.ImportClause: // TODO limit to default import?
        case ts.SyntaxKind.Identifier:
            switch (node.parent!.kind) {
                case ts.SyntaxKind.NamespaceImport:
                case ts.SyntaxKind.ImportSpecifier:
                case ts.SyntaxKind.ExportSpecifier:
                case ts.SyntaxKind.ImportClause:
                    return true;
                default:
                    return false;
            }
        default:
            // TODO verify that ImportTypeNode is still not able to be internal
            return isTypeNodeKind(node.kind) && node.kind !== ts.SyntaxKind.ImportType;
    }
}
