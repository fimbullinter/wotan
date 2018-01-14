import { injectable } from 'inversify';
import { AbstractRule, RuleContext, FlattenedAst } from '../types';
import * as ts from 'typescript';
import { isTryStatement, getControlFlowEnd } from 'tsutils';

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
            if (isTryStatement(node) && node.finallyBlock !== undefined)
                for (const statement of getControlFlowEnd(node.finallyBlock).statements)
                    this.addFailureAtNode(
                        statement.getChildAt(0, this.sourceFile),
                        "Unsafe use of control flow statement inside 'finally'.",
                    );
    }
}
