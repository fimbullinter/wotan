import { TypedRule } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isPropertyDeclaration,
    isInConstContext,
    isObjectFlagSet,
    isObjectType,
    isTypeReference,
    isTupleType,
    isPropertyAccessExpression,
    isIdentifier,
    isEntityNameExpression,
    isPropertyAssignment,
    unionTypeParts,
    isSymbolFlagSet,
    isIntersectionType,
    isCallExpression,
    isShorthandPropertyAssignment,
    isVariableDeclaration,
} from 'tsutils';
import * as ts from 'typescript';
import { getPropertyOfType } from '../utils';

export class Rule extends TypedRule {
    public apply() {
        debugger;
        const re = /\bextends\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (
                !ts.isHeritageClause(node) ||
                node.token !== ts.SyntaxKind.ExtendsKeyword ||
                node.types.length === 0 ||
                node.types.pos !== re.lastIndex ||
                node.parent!.kind === ts.SyntaxKind.InterfaceDeclaration
            )
                continue;
            let baseType: ts.Type | undefined;
            for (const member of node.parent!.members) {
                if (!isPropertyDeclaration(member))
                    continue;
                const symbol = this.checker.getSymbolAtLocation(member.name);
                if (symbol === undefined)
                    continue;
                if (baseType === undefined)
                    baseType = this.checker.getTypeAtLocation(node.types[0]);
                if (
                    getPropertyOfType(baseType, symbol.escapedName) !== undefined &&
                    isPropertyReadonlyInType(baseType, symbol.escapedName, this.checker)
                )
                    this.addFindingAtNode(
                        member.name,
                        `Overriding readonly property '${member.name.getText(this.sourceFile)}' might fail at runtime.`,
                    );
            }
        }
    }
}
