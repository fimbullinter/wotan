import * as ts from 'typescript';
import { excludeDeclarationFiles, Replacement, typescriptOnly, ConfigurableTypedRule } from '@fimbul/ymir';
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
    getPropertyName,
    hasSideEffects,
    isStringLiteral,
} from 'tsutils';

export interface Options {
    mode: 'when-possible' | 'never' | 'consistent';
}

const FAILURE_STRING = {
    never: 'Parameter properties have been disallowed.',
    whenPossible: 'Use parameter properties when possible.',
    consistent: {
        canBeParamPropsOnly: 'All parameters can be parameter properties.',
        cannotBeParamPropsOnly: 'Only use parameter properties if all parameters can be parameter properties.',
    },
};

@excludeDeclarationFiles
@typescriptOnly
export class Rule extends ConfigurableTypedRule<Options> {
    protected parseOptions(options: Options | null | undefined): Options {
        return options || { mode: 'consistent' };
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (
                (isClassDeclaration(node) || isClassExpression(node)) &&
                node.members.filter(isConstructorDeclaration).length > 0
            ) {
                const construct = node.members.find(
                    (member) => isConstructorDeclaration(member) && member.body !== undefined,
                );
                if (construct && construct.parent)
                    this.checkConstructorParameters(<ts.ConstructorDeclaration>construct);
            }
        }
    }

    private checkConstructorParameters(construct: ts.ConstructorDeclaration): void {
        switch (this.options.mode) {
            case 'never':
                for (const param of construct.parameters.filter(isParameterProperty))
                    this.addFailureAtNode(
                        param,
                        FAILURE_STRING.never,
                        getFixerForDisallowedParameterProp(
                            construct,
                            param,
                            getLineBreakStyle(this.context.sourceFile),
                        ),
                    );
                break;
            case 'when-possible':
                for (const param of construct.parameters)
                    if (!isParameterProperty(param) && this.canBeParameterProperty(param, construct))
                        this.addFailureAtNode(
                            param,
                            FAILURE_STRING.whenPossible,
                            getFixerForLonghandProp(param, construct),
                        );
                break;
            default:
                if (construct.parameters.every(isParameterProperty)) return;

                const allPropsCanBeParamProps = construct.parameters
                    .filter((param) => !isParameterProperty(param))
                    .every((param) => this.canBeParameterProperty(param, construct));

                if (!allPropsCanBeParamProps && construct.parameters.some(isParameterProperty)) {
                    for (const param of construct.parameters.filter(isParameterProperty))
                        this.addFailure(
                            construct.parameters.pos,
                            construct.parameters.end,
                            FAILURE_STRING.consistent.cannotBeParamPropsOnly,
                            getFixerForDisallowedParameterProp(
                                construct,
                                param,
                                getLineBreakStyle(this.context.sourceFile),
                            ),
                        );
                } else if (allPropsCanBeParamProps && !construct.parameters.every(isParameterProperty)) {
                    for (const param of construct.parameters.filter((p) => !isParameterProperty(p)))
                        this.addFailure(
                            construct.parameters.pos,
                            construct.parameters.end,
                            FAILURE_STRING.consistent.canBeParamPropsOnly,
                            getFixerForLonghandProp(param, construct),
                        );
                }
        }
    }

    private canBeParameterProperty(param: ts.ParameterDeclaration, construct: ts.ConstructorDeclaration): boolean {
        const member = construct.parent!.members.find(
            (mem) =>
                isPropertyDeclaration(mem) &&
                mem.name.getText() === param.name.getText() &&
                this.checker.typeToString(this.checker.getTypeAtLocation(mem)) ===
                    this.checker.typeToString(this.checker.getTypeAtLocation(param)),
        );
        if (member && !member.decorators) {
            for (const stmt of statementsMinusDirectivesAndSuper(construct)) {
                if (isStatementThatCompromisesFixer(stmt, param)) return false;
                if (isSimpleParamToPropAssignment(stmt, param)) return true;
            }
        }

        return false;
    }
}

function getFixerForDisallowedParameterProp(
    construct: ts.ConstructorDeclaration,
    param: ts.ParameterDeclaration,
    lineBreak: string,
): Replacement[] {
    const finalDirective = getFinalDirective(construct);
    const superCall = getSuperCall(construct);
    return [
        /* Add assignment after directives and super() call (if they exists) */
        Replacement.append(
            superCall ? superCall.end : finalDirective ? finalDirective.end : construct.body!.getStart() + 1,
            `${lineBreak}this.${param.name.getText()} = ${param.name.getText()};`,
        ),

        /* Add properties to class, trimming off default values if necessary */
        Replacement.append(
            construct.getStart(),
            (param.getText().indexOf('=') > -1
                ? param.getText().substring(0, param.getText().indexOf('=') - 1)
                : param.getText()) +
                ';' +
                lineBreak,
        ),

        /* Finally, delete modifiers from the parameter prop */
        Replacement.delete(param.pos, param.name.getStart()),
    ];
}

function getFixerForLonghandProp(param: ts.ParameterDeclaration, construct: ts.ConstructorDeclaration): Replacement[] {
    /* Class member and assignment to be removed */
    const member = construct
        .parent!.members.filter(isPropertyDeclaration)
        .find((prop) => getPropertyName(prop.name) === param.name.getText())!;
    const assignment = construct
        .body!.statements.filter(isExpressionStatement)
        .find((stmt) => isSimpleParamToPropAssignment(stmt, param))!;

    return [
        Replacement.delete(member.getStart(), member.end),
        Replacement.delete(assignment.getStart(), assignment.end),

        /* Append access modifiers to parameter declaration */
        Replacement.append(
            param.getStart(),
            member.modifiers ? member.modifiers.map((mod) => mod.getText()).join(' ') + ' ' : 'public ',
        ),
    ];
}

/**
 * @description
 * If directive(s) such as 'use strict' exist in the constructor body, returns
 * the last directive, otherwise undefined.
 *
 * @param ts.ConstructorDeclaration construct
 * @returns ts.ExpressionStatement | undefined
 */
function getFinalDirective(construct: ts.ConstructorDeclaration): ts.ExpressionStatement | undefined {
    let finalDirectiveIndex = -1;
    for (const stmt of construct.body!.statements) {
        if (isExpressionStatement(stmt) && isStringLiteral(stmt.expression)) {
            finalDirectiveIndex = construct.body!.statements.indexOf(stmt);
            continue;
        }
        break;
    }
    return finalDirectiveIndex > -1
        ? <ts.ExpressionStatement>construct.body!.statements[finalDirectiveIndex]
        : undefined;
}

/**
 * @description
 * Returns the super call expression in the constructor body if it exists, otherwise undefined.
 *
 * @param ts.ConstructorDeclaration construct
 * @returns ts.ExpressionStatement | undefined
 */
function getSuperCall(construct: ts.ConstructorDeclaration): ts.ExpressionStatement | undefined {
    const finalDirective = getFinalDirective(construct);
    const firstNonDirectiveStmt = finalDirective
        ? /* It's possible that the body is comprised of directives only */
          construct.body!.statements.length > construct.body!.statements.indexOf(finalDirective) + 1
            ? construct.body!.statements[construct.body!.statements.indexOf(finalDirective) + 1]
            : undefined
        : construct.body!.statements[0];

    return firstNonDirectiveStmt &&
        isExpressionStatement(firstNonDirectiveStmt) &&
        isCallExpression(firstNonDirectiveStmt.expression) &&
        firstNonDirectiveStmt.expression.expression.kind === ts.SyntaxKind.SuperKeyword
        ? firstNonDirectiveStmt
        : undefined;
}

/**
 * @description
 * Checks if a statement assigns the parameter to a class member property.
 *
 * @param ts.Statement stmt
 * @param ts.ParameterDeclaration param
 * @returns boolean
 */
function isSimpleParamToPropAssignment(stmt: ts.Statement, param: ts.ParameterDeclaration): boolean {
    return (
        isExpressionStatement(stmt) &&
        isBinaryExpression(stmt.expression) &&
        isPropertyAccessExpression(stmt.expression.left) &&
        stmt.expression.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
        isIdentifier(stmt.expression.right) &&
        stmt.expression.left.name.getText() === param.name.getText() &&
        stmt.expression.right.text === param.name.getText()
    );
}

/**
 * @description
 * We can only autofix longhand props -> param props if certain conditions are met within the constructor body.
 * See https://github.com/fimbullinter/wotan/issues/167#issuecomment-378945862 for more details on these conditions.
 *
 * @param ts.Statement stmt
 * @param ts.ParameterDeclaration param
 * @returns boolean
 */
function isStatementThatCompromisesFixer(stmt: ts.Statement, param: ts.ParameterDeclaration): boolean {
    return (
        !isExpressionStatement(stmt) ||
        !isBinaryExpression(stmt.expression) ||
        stmt.expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        hasSideEffects(stmt.expression.left) ||
        hasSideEffects(stmt.expression.right) ||
        /* This is the prop we care about */
        (isPropertyAccessExpression(stmt.expression.left) &&
            stmt.expression.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
            stmt.expression.left.name.getText() === param.name.getText() &&
            /* But it's being assigned something else first */
            (!isIdentifier(stmt.expression.right) ||
                (isIdentifier(stmt.expression.right) && stmt.expression.right.text !== param.name.getText())))
    );
}

/**
 * @description
 * Returns all statements in a constructor body with the exception of super calls
 * and directives such as 'use strict'.
 *
 * @param ts.ConstructorDeclaration construct
 * @returns ts.Statement[]
 */
function statementsMinusDirectivesAndSuper(construct: ts.ConstructorDeclaration): ts.Statement[] {
    const finalDirective = getFinalDirective(construct);
    const superCall = getSuperCall(construct);
    return superCall
        ? construct.body!.statements.slice(construct.body!.statements.indexOf(superCall) + 1)
        : finalDirective
            ? construct.body!.statements.slice(construct.body!.statements.indexOf(finalDirective) + 1)
            : construct.body!.statements.slice();
}
