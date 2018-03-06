import { TypedRule, Replacement } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isIdentifier,
    isPropertyAccessExpression,
    isCallExpression,
    isObjectLiteralExpression,
    unionTypeParts,
    isFalsyType,
} from 'tsutils';

export class Rule extends TypedRule {
    public static supports(sourceFile: ts.SourceFile) {
        return !sourceFile.isDeclarationFile;
    }

    public apply() {
        const re = /(?:[.\n]|\*\/)\s*assign\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), re.lastIndex - 1)!;
            if (node.kind !== ts.SyntaxKind.Identifier || node.end !== re.lastIndex)
                continue;
            const parent = node.parent!;
            if (!isPropertyAccessExpression(parent) || parent.name !== node ||
                !isIdentifier(parent.expression) || parent.expression.text !== 'Object')
                continue;
            const grandParent = parent.parent!;
            if (!isCallExpression(grandParent) || grandParent.expression !== parent ||
                grandParent.arguments.length === 0 || !isObjectLiteralExpression(grandParent.arguments[0]))
                continue;
            if (grandParent.arguments.length === 1) {
                this.addFailureAtNode(
                    grandParent,
                    "No need for 'Object.assign', use the object directly.",
                    createFix(grandParent, this.sourceFile),
                );
            } else if (grandParent.arguments.every(this.isSpreadableObject, this)) {
                this.addFailureAtNode(grandParent, "Prefer object spread over 'Object.assign'.", createFix(grandParent, this.sourceFile));
            }
        }
    }

    private isSpreadableObject(node: ts.Expression): boolean {
        switch (node.kind) {
            case ts.SyntaxKind.ThisKeyword:
            case ts.SyntaxKind.SpreadElement:
                return false;
            case ts.SyntaxKind.ObjectLiteralExpression:
                return true;
        }
        const type = this.checker.getTypeAtLocation(node);
        if (type.flags & ts.TypeFlags.Any)
            return true;
        let seenObject = false;
        for (const t of unionTypeParts(type)) {
            if (t.flags & (ts.TypeFlags.Object | ts.TypeFlags.NonPrimitive)) {
                seenObject = true;
            } else if (!isFalsyType(t)) {
                return false;
            }
        }
        return seenObject;
    }
}

function createFix(node: ts.CallExpression, sourceFile: ts.SourceFile) {
    const args = node.arguments;
    const objectNeedsParens = node.parent!.kind === ts.SyntaxKind.ArrowFunction || node.parent!.kind === ts.SyntaxKind.ExpressionStatement;
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
