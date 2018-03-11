import { TypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isBinaryExpression,
    isPrefixUnaryExpression,
    unionTypeParts,
    isFalsyType,
    isParenthesizedExpression,
    isTypeOfExpression,
    isTextualLiteral,
    isIdentifier,
} from 'tsutils';
import { isStrictNullChecksEnabled } from '../utils';

interface TypePredicate {
    nullable: boolean;
    check(type: ts.Type): boolean;
}

interface Equals {
    negated: boolean;
    strict: boolean;
}

const primitiveFlags = ts.TypeFlags.BooleanLike | ts.TypeFlags.NumberLike | ts.TypeFlags.StringLike | ts.TypeFlags.ESSymbolLike |
    ts.TypeFlags.Undefined | ts.TypeFlags.Void;

const predicates: Record<string, TypePredicate> = {
    object: {
        nullable: true,
        check(type) {
            return (type.flags & primitiveFlags) === 0 && !isTypeofFunction(type);
        },
    },
    number: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.NumberLike),
    },
    string: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.StringLike),
    },
    boolean: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.BooleanLike),
    },
    symbol: {
        nullable: false,
        check: checkFlags(ts.TypeFlags.ESSymbolLike),
    },
    function: {
        nullable: false,
        check: isTypeofFunction,
    },
    null: {
        nullable: true,
        check: checkFlags(ts.TypeFlags.Null),
    },
    undefined: {
        nullable: true,
        check: checkFlags(ts.TypeFlags.Undefined | ts.TypeFlags.Void),
    },
    nullOrUndefined: {
        nullable: true,
        check: checkFlags(ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void),
    },
};

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    private strictNullChecks = isStrictNullChecksEnabled(this.program.getCompilerOptions());

    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.IfStatement:
                    this.checkCondition((<ts.IfStatement>node).expression);
                    break;
                case ts.SyntaxKind.ConditionalExpression:
                    this.checkCondition((<ts.ConditionalExpression>node).condition);
                    break;
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.DoStatement:
                    if ((<ts.WhileStatement | ts.DoStatement>node).expression.kind !== ts.SyntaxKind.TrueKeyword)
                        this.checkCondition((<ts.WhileStatement | ts.DoStatement>node).expression);
                    break;
                case ts.SyntaxKind.ForStatement: {
                    const {condition} = <ts.ForStatement>node;
                    if (condition !== undefined && condition.kind !== ts.SyntaxKind.TrueKeyword)
                        this.checkCondition(condition);
                    break;
                }
                case ts.SyntaxKind.BinaryExpression:
                    if (isLogicalOperator((<ts.BinaryExpression>node).operatorToken.kind))
                        this.checkNode((<ts.BinaryExpression>node).left);
                    break;
                case ts.SyntaxKind.PrefixUnaryExpression:
                    if ((<ts.PrefixUnaryExpression>node).operator === ts.SyntaxKind.ExclamationToken)
                        this.checkNode((<ts.PrefixUnaryExpression>node).operand);
            }
        }
    }

    private checkCondition(node: ts.Expression) {
        if (node.kind === ts.SyntaxKind.PrefixUnaryExpression)
            return;
        if (!isBinaryExpression(node))
            return this.checkNode(node);
        if (isLogicalOperator(node.operatorToken.kind))
            return this.checkNode(node.right);
    }

    private checkNode(node: ts.Expression) {
        switch (this.isTruthyFalsy(node)) {
            case true:
                return this.addFailureAtNode(node, 'Expression is always truthy.');
            case false:
                return this.addFailureAtNode(node, 'Expression is always falsy.');
        }
    }

    private isTruthyFalsy(node: ts.Expression): boolean | undefined {
        if (isBinaryExpression(node)) {
            switch (node.operatorToken.kind) {
                case ts.SyntaxKind.ExclamationEqualsEqualsToken:
                case ts.SyntaxKind.ExclamationEqualsToken:
                case ts.SyntaxKind.EqualsEqualsEqualsToken:
                case ts.SyntaxKind.EqualsEqualsToken:
                    return this.isConstantComparison(node.left, node.right, node.operatorToken.kind);
            }
        } else if (isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
            switch (this.isTruthyFalsy(node.operand)) {
                case true:
                    return false;
                case false:
                    return true;
                default:
                    return;
            }
        }
        return executePredicate(this.checker.getTypeAtLocation(node), truthyFalsy);
    }

    private isConstantComparison(left: ts.Expression, right: ts.Expression, operator: ts.EqualityOperator) {
        left = unwrapParens(left);
        right = unwrapParens(right);
        const equals: Equals = {
            negated: operator === ts.SyntaxKind.ExclamationEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsToken,
            strict: operator === ts.SyntaxKind.ExclamationEqualsEqualsToken || operator === ts.SyntaxKind.EqualsEqualsEqualsToken,
        };
        let result = this.checkEquals(left, right, equals);
        if (result === undefined)
            result = this.checkEquals(right, left, equals);
        return result;
    }

    private checkEquals(left: ts.Expression, right: ts.Expression, equals: Equals): boolean | undefined {
        let predicate: TypePredicate;
        if (isTypeOfExpression(left)) {
            if (isTextualLiteral(right)) {
                switch (right.text) {
                    case 'number':
                    case 'string':
                    case 'boolean':
                    case 'symbol':
                    case 'object':
                    case 'function':
                    case 'undefined':
                        left = left.expression;
                        predicate = predicates[right.text];
                        break;
                    default:
                        return equals.negated;
                }
            } else if (right.kind === ts.SyntaxKind.NullKeyword ||
                       isIdentifier(right) && right.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword) {
                return equals.negated;
            }
            return;
        }
        if (right.kind === ts.SyntaxKind.NullKeyword) {
            predicate = equals.strict ? predicates.null : predicates.nullOrUndefined;
        } else if (isIdentifier(right) && right.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword) {
            predicate = equals.strict ? predicates.undefined : predicates.nullOrUndefined;
        } else {
            return;
        }
        return this.nullAwarePredicate(this.checker.getTypeAtLocation(left), predicate);
    }

    private nullAwarePredicate(type: ts.Type, predicate: TypePredicate): boolean | undefined {
        if (!this.strictNullChecks && predicate.nullable)
            return;
        const result = executePredicate(type, predicate.check);
        return result && !this.strictNullChecks
            ? undefined
            : result;
    }
}

function truthyFalsy(type: ts.Type) {
    if (type.flags & ts.TypeFlags.PossiblyFalsy)
        return isFalsyType(type) ? false : undefined;
    return true;
}

function executePredicate(type: ts.Type, predicate: (type: ts.Type) => boolean | undefined) {
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Never))
        return;
    // TODO Instantiable types
    let result: boolean | undefined;
    for (const t of unionTypeParts(type)) {
        switch (predicate(t)) {
            case true:
                if (result === false)
                    return;
                result = true;
                break;
            case false:
                if (result === true)
                    return;
                result = false;
                break;
            default:
                return;
        }
    }
    return result;
}

function unwrapParens(node: ts.Expression) {
    while (isParenthesizedExpression(node))
        node = node.expression;
    return node;
}

function isLogicalOperator(kind: ts.BinaryOperator) {
    return kind === ts.SyntaxKind.AmpersandAmpersandToken || kind === ts.SyntaxKind.BarBarToken;
}

function checkFlags(flags: ts.TypeFlags) {
    return (type: ts.Type) => (type.flags & flags) !== 0;
}

function isTypeofFunction(type: ts.Type) {
    if (type.getCallSignatures().length !== 0 || type.getConstructSignatures().length !== 0)
            return true;
    return false; // TODO `Function`
}
