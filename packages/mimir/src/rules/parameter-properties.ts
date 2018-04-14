import * as ts from 'typescript';
import { excludeDeclarationFiles, ConfigurableRule, Replacement } from '@fimbul/ymir';
import {
    getLineBreakStyle,
    isCallExpression,
    isExpressionStatement,
    isClassDeclaration,
    isClassExpression,
    isConstructorDeclaration,
    isParameterProperty,
    isBinaryExpression,
    isPropertyAccessExpression,
    isIdentifier,
    isPropertyDeclaration,
    hasSideEffects,
} from 'tsutils';

export interface Options {
    mode: 'when-possible' | 'never';
}

@excludeDeclarationFiles
export class Rule extends ConfigurableRule<Options> {
    protected parseOptions(options: Options | null | undefined): Options {
        return options || { mode: 'when-possible' };
    }

    public apply() {
        const checkClass = (node: ts.Node): void => {
            if (
                (isClassDeclaration(node) || isClassExpression(node)) &&
                node.members.filter(isConstructorDeclaration).length === 1
            )
                this.checkConstructorParameters(node.members.find(isConstructorDeclaration)!, node);

            return ts.forEachChild(node, checkClass);
        };
        ts.forEachChild(this.sourceFile, checkClass);
    }

    private checkConstructorParameters(
        construct: ts.ConstructorDeclaration,
        classNode: ts.ClassDeclaration | ts.ClassExpression,
    ): void {
        if (this.options.mode === 'never' && construct.parameters.some(isParameterProperty)) {
            this.context.addFailure(
                construct.parameters.pos,
                construct.parameters.end,
                this.failureString(),
                this.getFixerForDisallowedParameterProps(construct),
            );
        } else if (this.options.mode === 'when-possible') {
            for (const parameter of construct.parameters.filter(
                (p: ts.ParameterDeclaration) => !isParameterProperty(p) && canBeParameterProperty(p, construct),
            ))
                this.addFailureAtNode(
                    parameter,
                    this.failureString(),
                    getFixerForLonghandProp(parameter, construct, classNode),
                );
        }
    }

    private failureString(): string {
        return this.options.mode === 'never'
            ? 'Parameter properties have been disallowed.'
            : 'Use parameter properties when possible';
    }

    private getFixerForDisallowedParameterProps(construct: ts.ConstructorDeclaration): Replacement[] {
        const replacements: Replacement[] = [];
        for (const paramProp of construct.parameters.filter(isParameterProperty)) {
            /* Before adding assignments to the constructor body, check for a super() call */
            const superCall = getSuperCall(construct);
            replacements.push(
                Replacement.append(
                    superCall ? superCall.end : construct.body!.getStart() + 1,
                    `${getLineBreakStyle(
                        this.sourceFile,
                    )}this.${paramProp.name.getText()} = ${paramProp.name.getText()};`,
                ),
            );

            /* Add properties to class, trimming off default values if necessary */
            const paramText =
                paramProp.getText().indexOf('=') > -1
                    ? paramProp.getText().substring(0, paramProp.getText().indexOf('=') - 1)
                    : paramProp.getText();

            replacements.push(
                Replacement.append(construct.getStart() - 1, paramText + ';' + getLineBreakStyle(this.sourceFile)),
            );

            /* Finally, delete modifiers from the parameter prop */
            replacements.push(Replacement.delete(paramProp.pos, paramProp.name.getFullStart()));
        }

        return replacements;
    }
}

function canBeParameterProperty(param: ts.ParameterDeclaration, construct: ts.ConstructorDeclaration): boolean {
    const stmts = Array.from(construct.body!.statements);
    if (getSuperCall(construct)) stmts.shift();
    for (const stmt of stmts) {
        if (
            !isExpressionStatement(stmt) ||
            !isBinaryExpression(stmt.expression) ||
            !(stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
            hasSideEffects(stmt.expression.left) ||
            hasSideEffects(stmt.expression.right)
        )
            return false;

        if (
            isPropertyAccessExpression(stmt.expression.left) &&
            stmt.expression.left.name.text === param.name.getText() &&
            isIdentifier(stmt.expression.right) &&
            stmt.expression.right.text === param.name.getText()
        )
            return true;
    }
    return false;
}

function getFixerForLonghandProp(
    parameter: ts.ParameterDeclaration,
    construct: ts.ConstructorDeclaration,
    classNode: ts.ClassDeclaration | ts.ClassExpression,
): Replacement[] {
    const replacements: Replacement[] = [];

    const member = classNode.members
        .filter(isPropertyDeclaration)
        .find((prop) => prop.name.getText() === parameter.name.getText())!;

    /* Remove the property declaration */
    replacements.push(Replacement.delete(member.getStart(), member.end));

    let modifiers = '';
    if (member.modifiers) {
        for (const modifier of member.modifiers) modifiers += modifier.getText() + ' ';
    } else {
        modifiers = 'public ';
    }
    /* Append access modifiers to parameter declaration */
    replacements.push(Replacement.append(parameter.getStart(), modifiers));

    const assignment = construct
        .body!.statements.filter(isExpressionStatement)
        .find(
            (stmt) =>
                isBinaryExpression(stmt.expression) &&
                isPropertyAccessExpression(stmt.expression.left) &&
                stmt.expression.left.name.text === parameter.name.getText() &&
                isIdentifier(stmt.expression.right) &&
                stmt.expression.right.text === parameter.name.getText(),
        );

    /* Remove assignment from the constructor body */
    if (assignment) replacements.push(Replacement.delete(assignment.getStart(), assignment.end));

    return replacements;
}

function getSuperCall(construct: ts.ConstructorDeclaration): ts.ExpressionStatement | undefined {
    const firstStmt = construct.body!.statements.length > 0 ? construct.body!.statements[0] : undefined;
    return firstStmt &&
        isExpressionStatement(firstStmt) &&
        isCallExpression(firstStmt.expression) &&
        firstStmt.expression.expression.kind === ts.SyntaxKind.SuperKeyword
        ? firstStmt
        : undefined;
}
