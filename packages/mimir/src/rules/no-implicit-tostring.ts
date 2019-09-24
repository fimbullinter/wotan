import { ConfigurableTypedRule } from '@fimbul/ymir';
import * as ts from 'typescript';
import { unionTypeParts, isIntersectionType } from 'tsutils';

interface RawOptions {
    allowPrimitive?: boolean;
    allowNull?: boolean;
    allowUndefined?: boolean;
    allowNumber?: boolean;
    allowBigInt?: boolean;
    allowBoolean?: boolean;
    allowNever?: boolean;
}

interface Options {
    allowNever: boolean;
    mask: Type;
}

const enum Type {
    String = 1,
    Number = 2,
    BigInt = 4,
    Boolean = 8,
    Null = 16,
    Undefined = 32,
    NonPrimitive = 64,
    Any = 128,
    Symbol = 256,
    Unknown = 512,
}

export class Rule extends ConfigurableTypedRule<Options> {
    public parseOptions(options: RawOptions | null | undefined) {
        let allowed = Type.String | Type.Any;
        let allowNever = false;
        if (options) {
            if (options.allowPrimitive) {
                allowed |= Type.Number | Type.BigInt | Type.Boolean | Type.Null | Type.Undefined;
            } else {
                if (options.allowNumber)
                    allowed |= Type.Number;
                if (options.allowBigInt)
                    allowed |= Type.BigInt;
                if (options.allowBoolean)
                    allowed |= Type.Boolean;
                if (options.allowNull)
                    allowed |= Type.Null;
                if (options.allowUndefined)
                    allowed |= Type.Undefined;
            }
            if (options.allowNever)
                allowNever = true;
        }
        return {
            allowNever,
            mask: ~allowed,
        };
    }

    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.TemplateSpan:
                    if (node.parent!.parent!.kind !== ts.SyntaxKind.TaggedTemplateExpression)
                        this.checkExpression((<ts.TemplateSpan>node).expression);
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    this.checkBinaryExpression(<ts.BinaryExpression>node);
                    break;
                case ts.SyntaxKind.ElementAccessExpression:
                    // TODO disallow numbers if there's a string index signature?
            }
        }
    }

    private checkBinaryExpression(node: ts.BinaryExpression) {
        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            const l = this.getType(node.left);
            const r = this.getType(node.right);
            if (l === Type.String) {
                if (r !== Type.String)
                    this.checkExpression(node.right, r);
            } else if (r === Type.String) {
                this.checkExpression(node.left, l);
            }
        } else if (node.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken && this.getType(node.left) === Type.String) {
            this.checkExpression(node.right);
        }
    }

    private getType(node: ts.Expression) {
        let type = this.checker.getTypeAtLocation(node);
        type = this.checker.getBaseConstraintOfType(type) || type;
        if (type.flags & ts.TypeFlags.Any)
            return Type.Any;
        if (type.flags & ts.TypeFlags.Unknown)
            return Type.Unknown;
        if (type.flags & ts.TypeFlags.Never)
            return 0;
        let result: Type = 0;
        for (let t of unionTypeParts(type)) {
            if (isIntersectionType(t))
                // handle tagged types by extracting the primitive
                t = t.types.find(({flags}) => (flags & ts.TypeFlags.NonPrimitive) === 0) || t;
            if (t.flags & ts.TypeFlags.StringLike) {
                result |= Type.String;
            } else if (t.flags & ts.TypeFlags.NumberLike) {
                result |= Type.Number;
            } else if (t.flags & ts.TypeFlags.BigIntLike) {
                result |= Type.BigInt;
            } else if (t.flags & ts.TypeFlags.BooleanLike) {
                result |= Type.Boolean;
            } else if (t.flags & ts.TypeFlags.Null) {
                result |= Type.Null;
            } else if (t.flags & ts.TypeFlags.Undefined) {
                result |= Type.Undefined;
            } else if (t.flags & ts.TypeFlags.ESSymbolLike) {
                result |= Type.Symbol;
            } else {
                result |= Type.NonPrimitive;
            }
        }
        return result;
    }

    private checkExpression(node: ts.Expression, type = this.getType(node)) {
        if (type !== 0) {
            // exclude all allowed types
            type &= this.options.mask;
            if (type === 0)
                return;
        } else if (this.options.allowNever) {
            return;
        }
        this.addFindingAtNode(node, `Unexpected implicit string coercion of '${formatType(type)}'.`);
    }
}

function formatType(type: Type) {
    if (type === 0)
        return 'never';
    if (type === Type.Unknown)
        return 'unknown';
    const types = [];
    if (type & Type.Number)
        types.push('number');
    if (type & Type.BigInt)
        types.push('bigint');
    if (type & Type.Boolean)
        types.push('boolean');
    if (type & Type.Null)
        types.push('null');
    if (type & Type.Undefined)
        types.push('undefined');
    if (type & Type.NonPrimitive)
        types.push('object');
    if (type & Type.Symbol)
        types.push('symbol');
    return types.join(' | ');
}
