import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import ts = require('typescript');
import {
    getAccessKind,
    AccessKind,
    getLateBoundPropertyNames,
    unionTypeParts,
    getPropertyOfType,
    isReassignmentTarget,
    getLateBoundPropertyNamesOfPropertyName,
} from 'tsutils';
import { tryGetBaseConstraintType, addNodeToPropertyNameList, PropertyNameWithLocation, destructuredProperties } from '../utils';

@excludeDeclarationFiles
export class Rule extends TypedRule {
    public apply() {
        for (const node of this.context.getFlatAst()) {
            switch (node.kind) {
                case ts.SyntaxKind.PropertyAccessExpression:
                case ts.SyntaxKind.ElementAccessExpression:
                    if (getAccessKind(node) & AccessKind.Read)
                        this.checkAccessExpression(<ts.PropertyAccessExpression | ts.ElementAccessExpression>node);
                    break;
                case ts.SyntaxKind.ObjectBindingPattern:
                    this.checkObjectBindingPattern(<ts.ObjectBindingPattern>node);
                    break;
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                case ts.SyntaxKind.PropertyAssignment:
                    if (isReassignmentTarget(<ts.ObjectLiteralExpression>node.parent))
                        this.checkObjectDestructuring(<ts.PropertyAssignment | ts.ShorthandPropertyAssignment>node);
            }
        }
    }

    private checkAccessExpression(node: ts.PropertyAccessExpression | ts.ElementAccessExpression) {
        const accessedNames = node.kind === ts.SyntaxKind.PropertyAccessExpression
            ? [{node: node.name, displayName: node.name.text, symbolName: node.name.escapedText}]
            : Array.from(
                addNodeToPropertyNameList(node.argumentExpression, getLateBoundPropertyNames(node.argumentExpression, this.checker).names),
            );
        this.checkPropertiesOfType(tryGetBaseConstraintType(this.checker.getTypeAtLocation(node.expression), this.checker), accessedNames);
    }

    private checkObjectBindingPattern(node: ts.ObjectBindingPattern) {
        const type = tryGetBaseConstraintType(this.checker.getTypeAtLocation(node), this.checker);
        this.checkPropertiesOfType(type, Array.from(destructuredProperties(node, this.checker)));
    }

    private checkObjectDestructuring(node: ts.PropertyAssignment | ts.ShorthandPropertyAssignment) {
        const type = tryGetBaseConstraintType(this.checker.getTypeOfAssignmentPattern(node.parent!), this.checker);
        const accessedNames = Array.from(
            addNodeToPropertyNameList(node.name, getLateBoundPropertyNamesOfPropertyName(node.name, this.checker).names),
        );
        this.checkPropertiesOfType(type, accessedNames);
    }

    private checkPropertiesOfType(
        objectType: ts.Type,
        properties: readonly PropertyNameWithLocation[],
    ) {
        for (const type of unionTypeParts(objectType)) {
            for (const prop of properties) {
                const symbol = getPropertyOfType(type, prop.symbolName);
                if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Accessor) === ts.SymbolFlags.SetAccessor)
                    this.addFindingAtNode(
                        prop.node,
                        `Cannot read property '${prop.displayName}' of type '${this.checker.typeToString(type)}' as it only has a 'set' accessor.`,
                    );
            }
        }
    }
}
