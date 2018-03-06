import { AbstractRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { endsControlFlow, WrappedAst, getWrappedNodeAtPosition, isSwitchStatement } from 'tsutils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        const re = /\bswitch\s*?[\r\n(/]/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (isSwitchStatement(node) && node.getStart(this.sourceFile) === match.index)
                this.checkFallthrough(node.caseBlock.clauses);
        }
    }

    private checkFallthrough(clauses: ReadonlyArray<ts.CaseOrDefaultClause>) {
        for (let i = 1; i < clauses.length; ++i) {
            if (clauses[i - 1].statements.length !== 0 &&
                !ts.forEachLeadingCommentRange(this.sourceFile.text, clauses[i].pos, isFallthroughComment, this.sourceFile.text) &&
                !endsControlFlow(clauses[i - 1])) {
                const kind = clauses[i].kind === ts.SyntaxKind.CaseClause ? 'case' : 'default';
                const start = clauses[i].getStart(this.sourceFile);
                this.addFailure(start, start + kind.length, `Missing 'break' before '${kind}'.`);
            }
        }
    }
}

function isFallthroughComment(pos: number, end: number, _kind: ts.CommentKind, _newline: boolean, text: string) {
    return /^\s*falls? ?through\b/i.test(text.substring(pos + 2, end));
}
