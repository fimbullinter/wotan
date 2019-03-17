import { AbstractRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { endsControlFlow } from 'tsutils';
import { switchStatements } from '../utils';

@excludeDeclarationFiles
export class Rule extends AbstractRule {
    public apply() {
        for (const {caseBlock: {clauses}} of switchStatements(this.context)) {
            for (let i = 1; i < clauses.length; ++i) {
                if (clauses[i - 1].statements.length !== 0 &&
                    !ts.forEachLeadingCommentRange(this.sourceFile.text, clauses[i].pos, isFallthroughComment, this.sourceFile.text) &&
                    !endsControlFlow(clauses[i - 1])) {
                    const kind = clauses[i].kind === ts.SyntaxKind.CaseClause ? 'case' : 'default';
                    const start = clauses[i].getStart(this.sourceFile);
                    this.addFinding(start, start + kind.length, `Missing 'break' before '${kind}'.`);
                }
            }
        }
    }
}

function isFallthroughComment(pos: number, end: number, _kind: ts.CommentKind, _newline: boolean, text: string) {
    return /^\s*falls? ?through\b/i.test(text.substring(pos + 2, end));
}
