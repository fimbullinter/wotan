import { injectable } from 'inversify';
import { AbstractRule, RuleContext, FlattenedAst } from '../types';
import * as ts from 'typescript';
import { isSwitchStatement, endsControlFlow } from 'tsutils';

@injectable()
export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    constructor(context: RuleContext, private flatAst: FlattenedAst) {
        super(context);
    }

    public apply() {
        for (const node of this.flatAst)
            if (isSwitchStatement(node))
                this.checkSwitch(node);
    }

    private checkSwitch({caseBlock: {clauses}}: ts.SwitchStatement) {
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
