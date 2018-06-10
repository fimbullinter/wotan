import { TypedRule, excludeDeclarationFiles, requiresStrictNullChecks } from '../../../ymir/src';
import * as ts from 'typescript';
import { isReassignmentTarget, isObjectType, unionTypeParts, isClassLikeDeclaration } from 'tsutils';

interface PropertyInfo {
    known: boolean;
    names: ts.__String[];
    assignedNames: ts.__String[];
}

const emptyPropertyInfo: PropertyInfo = {
    known: false,
    names: [],
    assignedNames: [],
};

@excludeDeclarationFiles
@requiresStrictNullChecks
export class Rule extends TypedRule {
    public apply() {
        const checkedObjects = new Set<number>();
        for (const node of this.context.getFlatAst()) {
            if (
                node.kind === ts.SyntaxKind.SpreadAssignment &&
                !checkedObjects.has(node.parent!.pos) &&
                !isReassignmentTarget(<ts.ObjectLiteralExpression>node.parent)
            ) {
                checkedObjects.add(node.parent!.pos);
                this.checkObject(<ts.ObjectLiteralExpression>node.parent);
            }
        }
    }

    private checkObject({properties}: ts.ObjectLiteralExpression) {
        const propertiesSeen = new Set<ts.__String>();
        for (let i = properties.length - 1; i >= 0; --i) {
            const property = properties[i];
            const info = this.getPropertyInfo(property);
            if (info.known && info.names.every((name) => propertiesSeen.has(name))) {
                if (property.kind === ts.SyntaxKind.SpreadAssignment) {
                    this.addFailureAtNode(property, 'All properties of this object are overridden later.');
                } else {
                    this.addFailureAtNode(property.name, `Property '${property.name.getText(this.sourceFile)}' is overridden later.`);
                }
            }
            for (const name of info.assignedNames)
                propertiesSeen.add(name);
        }
    }

    private getPropertyInfo(property: ts.ObjectLiteralElementLike): PropertyInfo {
        switch (property.kind) {
            case ts.SyntaxKind.SpreadAssignment:
                return this.getPropertyInfoFromSpread(property.expression);
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                return {
                    known: true,
                    names: [property.name.escapedText],
                    assignedNames: [property.name.escapedText],
                };
            default: {
                const symbol = this.checker.getSymbolAtLocation(property.name);
                if (symbol === undefined)
                    return emptyPropertyInfo;
                return {
                    known: true,
                    names: [symbol.escapedName],
                    assignedNames: [symbol.escapedName],
                };
            }
        }
    }

    private getPropertyInfoFromSpread(node: ts.Expression): PropertyInfo {
        const type = this.checker.getTypeAtLocation(node)!;
        return unionTypeParts(type).map(getPropertyInfoFromType).reduce(combinePropertyInfo);
    }

}
function getPropertyInfoFromType(type: ts.Type): PropertyInfo {
    if (!isObjectType(type))
        return emptyPropertyInfo;
    const result: PropertyInfo = {
        known: (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0 ||
            type.getStringIndexType() === undefined && type.getNumberIndexType() === undefined,
        names: [],
        assignedNames: [],
    };
    for (const prop of type.getProperties()) {
        if (isClassMethod(prop))
            continue;
        if ((prop.flags & ts.SymbolFlags.Optional) === 0)
            result.assignedNames.push(prop.escapedName);
        result.names.push(prop.escapedName);
    }
    return result;
}
function isClassMethod(prop: ts.Symbol): boolean | undefined {
    if (prop.flags & ts.SymbolFlags.Method && prop.declarations !== undefined)
        for (const declaration of prop.declarations)
            if (isClassLikeDeclaration(declaration.parent!))
                return true;
    return false;
}

function combinePropertyInfo(a: PropertyInfo, b: PropertyInfo): PropertyInfo {
    return {
        known: a.known && b.known,
        names: [...a.names, ...b.names],
        assignedNames: a.assignedNames.filter((name) => b.assignedNames.includes(name)),
    };
}
