import { TypedRule } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isPropertyDeclaration,
    isPropertyReadonlyInType,
    getSingleLateBoundPropertyNameOfPropertyName,
    isClassLikeDeclaration,
    getChildOfKind,
} from 'tsutils';
import * as ts from 'typescript';

// TODO make an exception for redeclared variables?
// TODO parameter properties

export class Rule extends TypedRule {
    public apply() {
        const re = /\bclass\b/g;
        let wrappedAst: WrappedAst | undefined;
        for (let match = re.exec(this.sourceFile.text); match !== null; match = re.exec(this.sourceFile.text)) {
            const {node} = getWrappedNodeAtPosition(wrappedAst || (wrappedAst = this.context.getWrappedAst()), match.index)!;
            if (
                !isClassLikeDeclaration(node) ||
                node.heritageClauses === undefined ||
                node.heritageClauses[0].token !== ts.SyntaxKind.ExtendsKeyword ||
                node.heritageClauses[0].types.length === 0 ||
                getChildOfKind(node, ts.SyntaxKind.ClassKeyword, this.sourceFile)!.end !== re.lastIndex
            )
                continue;
            let baseType: ts.Type | undefined;
            for (const member of node.members) {
                if (!isPropertyDeclaration(member))
                    continue;
                const name = getSingleLateBoundPropertyNameOfPropertyName(member.name, this.checker);
                if (name === undefined)
                    continue;
                if (baseType === undefined)
                    baseType = this.checker.getTypeAtLocation(node.heritageClauses[0].types[0]);
                if (isPropertyReadonlyInType(baseType, name.symbolName, this.checker))
                    this.addFindingAtNode(
                        member.name,
                        `Overriding readonly property '${member.name.getText(this.sourceFile)}' might fail at runtime.`,
                    );
            }
        }
    }
}
