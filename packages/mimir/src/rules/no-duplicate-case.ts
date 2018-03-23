import { AbstractRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isTextualLiteral, isNumericLiteral, isPrefixUnaryExpression, isIdentifier, isLiteralType } from 'tsutils';
import { switchStatements } from '../utils';

export class Rule extends AbstractRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        for (const {caseBlock: {clauses}} of switchStatements(this.context)) {
            const expressionsSeen = new Set<string>();
            const valuesSeen = new Set<Primitive>();
            for (const clause of clauses) {
                if (clause.kind === ts.SyntaxKind.DefaultClause)
                    continue;
                const text = clause.expression.getText(this.sourceFile);
                if (expressionsSeen.has(text)) {
                    this.addFailureAtNode(clause.expression, `Duplicate 'case ${text}'.`);
                    continue;
                }
                expressionsSeen.add(text);
                this.getLiteralValue(clause.expression, (v) => {
                    if (valuesSeen.has(v))
                        return this.addFailureAtNode(
                            clause.expression,
                            `Duplicate 'case ${typeof v === 'string' ? `"${v}"` : String(v)}'.`,
                        );
                    valuesSeen.add(v);
                });
            }
        }
    }

    private getLiteralValue(node: ts.Expression, cb: (v: Primitive) => void) {
        let prefixFn: ApplyPrefixFn = identity;
        while (isPrefixUnaryExpression(node)) {
            const next = makePrefixFn(node, prefixFn);
            if (next === undefined)
                return;
            prefixFn = next;
            node = node.operand;
        }
        if (isTextualLiteral(node))
            return cb(prefixFn(node.text));
        if (isNumericLiteral(node))
            return cb(prefixFn(+node.text));
        if (node.kind === ts.SyntaxKind.NullKeyword)
            return cb(prefixFn(null)); // tslint:disable-line:no-null-keyword
        if (isIdentifier(node) && node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword)
            return cb(prefixFn(undefined));
        if (node.kind === ts.SyntaxKind.TrueKeyword)
            return cb(prefixFn(true));
        if (node.kind === ts.SyntaxKind.FalseKeyword)
            return cb(prefixFn(false));

        if (this.program === undefined)
            return;
        const checker = this.program.getTypeChecker();
        let type = checker.getTypeAtLocation(node);
        type = checker.getBaseConstraintOfType(type) || type;
        if (isLiteralType(type))
            return cb(prefixFn(type.value));
        if (type.flags & ts.TypeFlags.BooleanLiteral)
            return cb(prefixFn((<{intrinsicName: string}><{}>type).intrinsicName === 'true'));
        if (type.flags & ts.TypeFlags.Undefined)
            return cb(prefixFn(undefined));
        if (type.flags & ts.TypeFlags.Null)
            return cb(prefixFn(null)); // tslint:disable-line:no-null-keyword
    }
}

type Primitive = string | number | boolean | undefined | null;

type ApplyPrefixFn = (v: Primitive) => Primitive;

function identity<T>(v: T): T {
    return v;
}

function makePrefixFn(node: ts.PrefixUnaryExpression, next: ApplyPrefixFn): ApplyPrefixFn | undefined {
    switch (node.operator) {
        case ts.SyntaxKind.PlusToken:
            return (v) => next(+v!);
        case ts.SyntaxKind.MinusToken:
            return (v) => next(-v!);
        case ts.SyntaxKind.TildeToken:
            return (v) => next(~v!);
        case ts.SyntaxKind.ExclamationToken:
            return (v) => next(!v);
        default:
            return;
    }
}
