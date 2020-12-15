import { TypedRule, Replacement, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isIdentifier,
    isObjectLiteralExpression,
    unionTypeParts,
    isFalsyType,
} from 'tsutils';
import { findMethodCalls, objectLiteralNeedsParens } from '../utils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of findMethodCalls(this.context, 'assign')) {
            if (
                node.arguments.length === 0 || node.arguments[0].kind !== ts.SyntaxKind.ObjectLiteralExpression ||
                !isIdentifier(node.expression.expression) || node.expression.expression.escapedText !== 'Object'
            )
                continue;
            if (node.arguments.length === 1) {
                this.addFindingAtNode(node, "No need for 'Object.assign', use the object directly.", createFix(node, this.sourceFile));
            } else if (node.arguments.every(this.isSpreadableObject, this)) {
                this.addFindingAtNode(node, "Prefer object spread over 'Object.assign'.", createFix(node, this.sourceFile));
            }
        }
    }

    private isSpreadableObject(node: ts.Expression): boolean {
        switch (node.kind) {
            case ts.SyntaxKind.SpreadElement:
                return false;
            case ts.SyntaxKind.ObjectLiteralExpression:
                return true;
        }
        const type = this.checker.getTypeAtLocation(node)!;
        if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
            return true;
        let seenObject = false;
        const isSpreadable = (t: ts.Type): boolean => {
            if (t.flags & (ts.TypeFlags.Object | ts.TypeFlags.NonPrimitive)) {
                seenObject = true;
                return true;
            }
            if (t.flags & ts.TypeFlags.TypeParameter) {
                const constraint = this.checker.getBaseConstraintOfType(t);
                if (!constraint) {
                    seenObject = true;
                    return true;
                }
                return unionTypeParts(constraint).every(isSpreadable);
            }
            return isFalsyType(t);
        };
        return unionTypeParts(type).every(isSpreadable) && seenObject;
    }
}

function createFix(node: ts.CallExpression, sourceFile: ts.SourceFile) {
    const args = node.arguments;
    const objectNeedsParens = objectLiteralNeedsParens(node);
    const fix = [
        Replacement.replace(node.getStart(sourceFile), args[0].getStart(sourceFile), `${objectNeedsParens ? '(' : ''}{`),
        Replacement.replace(node.end - 1, node.end, `}${objectNeedsParens ? ')' : ''}`),
    ];
    let removedPrevious = false;
    for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        if (!isObjectLiteralExpression(arg)) {
            fix.push(Replacement.append(arg.getStart(sourceFile), '...'));
            removedPrevious = false;
            continue;
        }
        if (arg.properties.length === 0) {
            let end = arg.end;
            if (i !== args.length - 1) {
                end = args[i + 1].getStart(sourceFile);
            } else if (args.hasTrailingComma) {
                end = args.end;
            }
            // remove empty object iteral and the following comma if exists
            fix.push(Replacement.delete(removedPrevious ? arg.getStart(sourceFile) : arg.pos, end));
            removedPrevious = true;
        } else {
            const start = arg.getStart(sourceFile);
            fix.push(
                // remove open brace
                Replacement.delete(start, start + 1),
                // remove trailing comma if exists and close brace
                Replacement.delete(arg.properties[arg.properties.length - 1].end, arg.end),
            );
            removedPrevious = false;
        }
    }

    return fix;
}
