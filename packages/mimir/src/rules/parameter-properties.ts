import * as ts from 'typescript';
import { excludeDeclarationFiles, Replacement, typescriptOnly, ConfigurableRule } from '@fimbul/ymir';
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
    mode: Mode;
}

export enum Mode {
    Never,
    WhenPossible,
    Consistent,
}

const MESSAGES = {
    [Mode.Never]: 'Parameter properties have been disallowed.',
    [Mode.WhenPossible]: 'Use parameter properties when possible.',
    [Mode.Consistent]: {
        canBeParamPropsOnly: 'All parameters can be parameter properties.',
        cannotBeParamPropsOnly: 'Only use parameter properties if all parameters can be parameter properties.',
    },
};

@excludeDeclarationFiles
@typescriptOnly
export class Rule extends ConfigurableRule<Options> {
    protected parseOptions(options: { mode: string } | null | undefined): Options {
        if (options) {
            switch (options.mode) {
                case 'consistent':
                    return { mode: Mode.Consistent };
                case 'never':
                    return { mode: Mode.Never };
            }
        }
        return { mode: Mode.WhenPossible };
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            if (isClassDeclaration(node) || isClassExpression(node)) {
                const construct = node.members.find(
                    (member) => isConstructorDeclaration(member) && member.body !== undefined,
                );
                if (construct) this.checkConstructorParameters(<ts.ConstructorDeclaration>construct);
            }
        }
    }

    private checkConstructorParameters(construct: ts.ConstructorDeclaration): void {
        switch (this.options.mode) {
            case Mode.Never:
                for (const param of construct.parameters.filter(isParameterProperty))
                    this.addFindingAtNode(
                        param,
                        MESSAGES[Mode.Never],
                        getFixerForDisallowedParameterProp(
                            construct,
                            param,
                            getLineBreakStyle(this.context.sourceFile),
                        ),
                    );
                break;
            case Mode.Consistent:
                if (construct.parameters.every(isParameterProperty)) return;

                const allPropsCanBeParamProps = construct.parameters
                    .filter((param) => !isParameterProperty(param))
                    .every((param) => canBeParameterProperty(param, construct));

                if (!allPropsCanBeParamProps && construct.parameters.some(isParameterProperty)) {
                    for (const param of construct.parameters.filter(isParameterProperty))
                        this.addFinding(
                            param.pos,
                            param.end,
                            MESSAGES[Mode.Consistent].cannotBeParamPropsOnly,
                            getFixerForDisallowedParameterProp(
                                construct,
                                param,
                                getLineBreakStyle(this.context.sourceFile),
                            ),
                        );
                } else if (allPropsCanBeParamProps && !construct.parameters.every(isParameterProperty)) {
                    for (const param of construct.parameters.filter((p) => !isParameterProperty(p)))
                        this.addFinding(
                            param.pos,
                            param.end,
                            MESSAGES[Mode.Consistent].canBeParamPropsOnly,
                            getFixerForLonghandProp(param, construct),
                        );
                }
                break;
            default:
                for (const param of construct.parameters)
                    if (!isParameterProperty(param) && canBeParameterProperty(param, construct))
                        this.addFindingAtNode(
                            param,
                            MESSAGES[Mode.WhenPossible],
                            getFixerForLonghandProp(param, construct),
                        );
        }
    }
}

function canBeParameterProperty(param: ts.ParameterDeclaration, construct: ts.ConstructorDeclaration): boolean {
    if (!isIdentifier(param.name) || param.dotDotDotToken) return false;
    const member = construct.parent!.members.find((mem) => isPropertyMatchForParam(mem, param));
    if (member && !member.decorators) {
        for (const stmt of statementsMinusDirectivesAndSuper(construct)) {
            if (isStatementWithPossibleSideEffects(stmt, param)) return false;
            if (isSimpleParamToPropAssignment(stmt, param)) return true;
        }
    }

    return false;
}

function getFixerForDisallowedParameterProp(
    construct: ts.ConstructorDeclaration,
    param: ts.ParameterDeclaration,
    lineBreak: string,
): Replacement[] {
    return [
        /* Add assignment after directives and super() call (if they exists) */
        Replacement.append(
            getEndOfDirectivesAndSuper(construct),
            `${lineBreak}this.${param.name.getText()} = ${param.name.getText()};`,
        ),

        /* Add property to class */
        Replacement.append(construct.getStart(), getPropertyTextFromParam(param) + lineBreak),

        /* Finally, delete modifiers from the parameter prop */
        Replacement.delete(param.modifiers!.pos, param.modifiers!.end),
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
        Replacement.delete(member.pos, member.end),
        Replacement.delete(assignment.pos, assignment.end),

        /* Prepend access modifiers to parameter declaration */
        Replacement.append(
            param.name.getStart(),
            member.modifiers ? member.modifiers.map((mod) => mod.getText()).join(' ') + ' ' : 'public ',
        ),
    ];
}

function getEndOfDirectivesAndSuper(construct: ts.ConstructorDeclaration): number {
    const firstStmtIndex = Math.max(getFinalDirectiveIndex(construct), getSuperCallIndex(construct));
    if (firstStmtIndex === -1 || construct.body!.statements.length === 0) return construct.body!.getStart() + 1;

    return construct.body!.statements[firstStmtIndex].end;
}

/**
 * If directive(s) such as 'use strict' exist in the constructor body, returns
 * the last directive, otherwise undefined.
 */
function getFinalDirectiveIndex(construct: ts.ConstructorDeclaration): number {
    let finalDirectiveIndex = -1;
    for (const [index, stmt] of construct.body!.statements.entries()) {
        if (isExpressionStatement(stmt) && isStringLiteral(stmt.expression)) {
            finalDirectiveIndex = index;
            continue;
        }
        break;
    }
    return finalDirectiveIndex;
}

/**
 * Takes a parameter property and returns the text of the equivalent class element.
 */
function getPropertyTextFromParam(param: ts.ParameterDeclaration): string {
    const modifiers = param.modifiers ? param.modifiers.map((mod) => mod.getText()).join(' ') : '';
    const typeAnnotations = param.type ? param.type.getText() : '';
    return (
        modifiers +
        ' ' +
        param.name.getText() +
        (param.questionToken ? '?' : '') +
        (typeAnnotations ? ': ' + typeAnnotations : '') +
        ';'
    );
}

/**
 * Returns the super call expression index if it exists, otherwise -1.
 */
function getSuperCallIndex(construct: ts.ConstructorDeclaration): number {
    const statementIndex = getFinalDirectiveIndex(construct) + 1;
    const statements = construct.body!.statements;
    return statementIndex === statements.length || !isStatementSuperCall(statements[statementIndex])
        ? -1
        : statementIndex;
}

/**
 * Returns true when the prop is assigned any value other than the param identifier.
 */
function isNonParamAssignmentToProp(stmt: ts.ExpressionStatement, param: ts.ParameterDeclaration): boolean {
    return (
        isBinaryExpression(stmt.expression) &&
        isPropertyAccessExpression(stmt.expression.left) &&
        stmt.expression.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
        getPropertyName(stmt.expression.left.name) === param.name.getText() &&
        (!isIdentifier(stmt.expression.right) ||
            (isIdentifier(stmt.expression.right) && stmt.expression.right.text !== param.name.getText()))
    );
}

function isPropertyMatchForParam(mem: ts.ClassElement, param: ts.ParameterDeclaration): boolean {
    return (
        isPropertyDeclaration(mem) &&
        !mem.initializer &&
        (!mem.questionToken ? !param.questionToken : !!param.questionToken) &&
        getPropertyName(mem.name) === param.name.getText() &&
        (mem.type ? (param.type && param.type.getText()) === mem.type.getText() : !param.type)
    );
}

/**
 * Checks if a statement assigns the parameter to a class member property.
 */
function isSimpleParamToPropAssignment(stmt: ts.Statement, param: ts.ParameterDeclaration): boolean {
    return (
        isExpressionStatement(stmt) &&
        isBinaryExpression(stmt.expression) &&
        isPropertyAccessExpression(stmt.expression.left) &&
        stmt.expression.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
        isIdentifier(stmt.expression.right) &&
        stmt.expression.left.name.text === param.name.getText() &&
        stmt.expression.right.text === param.name.getText()
    );
}

function isStatementSuperCall(stmt: ts.Statement): boolean {
    return (
        isExpressionStatement(stmt) &&
        isCallExpression(stmt.expression) &&
        stmt.expression.expression.kind === ts.SyntaxKind.SuperKeyword
    );
}

/**
 * We can only autofix longhand props -> param props if certain conditions are met within the constructor body.
 * See https://github.com/fimbullinter/wotan/issues/167#issuecomment-378945862 for more details on these conditions.
 */
function isStatementWithPossibleSideEffects(stmt: ts.Statement, param: ts.ParameterDeclaration): boolean {
    return (
        !isExpressionStatement(stmt) ||
        !isBinaryExpression(stmt.expression) ||
        stmt.expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        hasSideEffects(stmt.expression.left) ||
        hasSideEffects(stmt.expression.right) ||
        isNonParamAssignmentToProp(stmt, param)
    );
}

/**
 * Returns all statements in a constructor body with the exception of super calls
 * and directives such as 'use strict'.
 */
function statementsMinusDirectivesAndSuper(construct: ts.ConstructorDeclaration): ts.Statement[] {
    return construct.body!.statements.slice(
        Math.max(getFinalDirectiveIndex(construct), getSuperCallIndex(construct)) + 1,
    );
}
