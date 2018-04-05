import * as ts from 'typescript';
import { ConfigurableRule } from '@fimbul/ymir';

export interface Options {
    never: any;
}

export class Rule extends ConfigurableRule<Options> {
    protected parseOptions(options: Options | null | undefined): Options {
        return { never: !!options && !!options.never && typeof options.never === 'boolean' };
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (ts.isConstructorDeclaration(node) && node.parameters.length > 0) {
                if (this.options.never) {
                    for (const param of node.parameters)
                        if (ts.isParameterPropertyDeclaration(param)) this.addFailureAtNode(param, this.failureString);
                    return;
                }

                const assignments = <ts.ExpressionStatement[]>node.body!.statements.filter(
                    (stmt: ts.Statement) =>
                        ts.isExpressionStatement(stmt) &&
                        ts.isBinaryExpression(stmt.expression) &&
                        ts.isIdentifier(stmt.expression.right) &&
                        ts.isPropertyAccessExpression(stmt.expression.left) &&
                        stmt.expression.left.expression.kind === 99,
                );

                for (const assignment of assignments)
                    if (
                        node.parameters.find(
                            (p: ts.ParameterDeclaration) =>
                                p.name.getText() === (<ts.Identifier>(<ts.BinaryExpression>assignment.expression).right).text,
                        ) !== undefined
                    )
                        this.addFailureAtNode(assignment, this.failureString);
            }
        }
    }

    private get failureString(): string {
        return this.options.never
            ? `Use of parameter properties has been disallowed.`
            : `Use a parameter property instead of assigning to members in the constructor.`;
    }
}
