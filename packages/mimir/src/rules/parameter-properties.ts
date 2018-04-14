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
    mode: 'when-possible' | 'never' | 'consistent';
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
        ts.forEachChild(this.context.sourceFile, checkClass);
    }

    private get failureString(): string {
        switch (this.options.mode) {
            case 'never':
                return 'Parameter properties have been disallowed.';
            case 'when-possible':
                return 'Use parameter properties when possible.';
            default:
                return 'Either all constructor parameters must be parameter properties, or none.';
        }
    }

    private checkConstructorParameters(
        construct: ts.ConstructorDeclaration,
        classNode: ts.ClassDeclaration | ts.ClassExpression,
    ): void {
        switch (this.options.mode) {
            case 'never':
                for (const param of construct.parameters.filter(isParameterProperty))
                    this.addFailureAtNode(
                        param,
                        this.failureString,
                        getFixerForDisallowedParameterProp(
                            construct,
                            param,
                            getLineBreakStyle(this.context.sourceFile),
                        ),
                    );
                break;
            case 'when-possible':
                for (const param of construct.parameters.filter(
                    (p: ts.ParameterDeclaration) => !isParameterProperty(p) && canBeParameterProperty(p, construct),
                ))
                    this.addFailureAtNode(
                        param,
                        this.failureString,
                        getFixerForLonghandProp(param, construct, classNode),
                    );
                break;
            default:
                if (construct.parameters.some(isParameterProperty) && !construct.parameters.every(isParameterProperty))
                    for (const param of construct.parameters.filter(isParameterProperty))
                        this.addFailure(
                            construct.parameters.pos,
                            construct.parameters.end,
                            this.failureString,
                            getFixerForDisallowedParameterProp(
                                construct,
                                param,
                                getLineBreakStyle(this.context.sourceFile),
                            ),
                        );
        }
    }
}

function canBeParameterProperty(param: ts.ParameterDeclaration, construct: ts.ConstructorDeclaration): boolean {
    const stmts = Array.from(construct.body!.statements);
    if (getSuperCall(construct)) stmts.shift();
    for (const stmt of stmts) {
        /**
         * See https://github.com/fimbullinter/wotan/issues/167#issuecomment-378945862 for details on this condition
         */
        if (
            !isExpressionStatement(stmt) ||
            !isBinaryExpression(stmt.expression) ||
            !(stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
            !isSimpleParamToPropAssignment(stmt, param) ||
            hasSideEffects(stmt.expression.left) ||
            hasSideEffects(stmt.expression.right)
        )
            return false;

        if (isSimpleParamToPropAssignment(stmt, param)) return true;
    }

    return false;
}

function getFixerForDisallowedParameterProp(
    construct: ts.ConstructorDeclaration,
    param: ts.ParameterDeclaration,
    lineBreak: string,
): Replacement[] {
    const superCall = getSuperCall(construct);
    return [
        /* Add assignment after super() call (if it exists) */
        Replacement.append(
            superCall ? superCall.end : construct.body!.getStart() + 1,
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

function getFixerForLonghandProp(
    param: ts.ParameterDeclaration,
    construct: ts.ConstructorDeclaration,
    classNode: ts.ClassDeclaration | ts.ClassExpression,
): Replacement[] {
    /* Class member and assignment to be removed */
    const member = classNode.members
        .filter(isPropertyDeclaration)
        .find((prop) => prop.name.getText() === param.name.getText())!;
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

function getSuperCall(construct: ts.ConstructorDeclaration): ts.ExpressionStatement | undefined {
    const firstStmt = construct.body!.statements.length > 0 ? construct.body!.statements[0] : undefined;

    return firstStmt &&
        isExpressionStatement(firstStmt) &&
        isCallExpression(firstStmt.expression) &&
        firstStmt.expression.expression.kind === ts.SyntaxKind.SuperKeyword
        ? firstStmt
        : undefined;
}

function isSimpleParamToPropAssignment(stmt: ts.ExpressionStatement, param: ts.ParameterDeclaration): boolean {
    return (
        isBinaryExpression(stmt.expression) &&
        isPropertyAccessExpression(stmt.expression.left) &&
        stmt.expression.left.name.text === param.name.getText() &&
        isIdentifier(stmt.expression.right) &&
        stmt.expression.right.text === param.name.getText()
    );
}
