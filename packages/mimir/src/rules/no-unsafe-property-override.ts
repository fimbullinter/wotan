import { TypedRule } from '@fimbul/ymir';
import {
    WrappedAst,
    getWrappedNodeAtPosition,
    isPropertyDeclaration,
    isPropertyReadonlyInType,
    getSingleLateBoundPropertyNameOfPropertyName,
} from 'tsutils';
import * as ts from 'typescript';

export class Rule extends TypedRule {
    public apply() {
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
                const name = getSingleLateBoundPropertyNameOfPropertyName(member.name, this.checker);
                if (name === undefined)
                    continue;
                if (baseType === undefined)
                    baseType = this.checker.getTypeAtLocation(node.types[0]);
                if (
                    isPropertyReadonlyInType(baseType, name.symbolName, this.checker)
                )
                    this.addFindingAtNode(
                        member.name,
                        `Overriding readonly property '${member.name.getText(this.sourceFile)}' might fail at runtime.`,
                    );
            }
        }
    }
}
