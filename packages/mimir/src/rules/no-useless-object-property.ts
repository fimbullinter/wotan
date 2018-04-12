import { TypedRule, excludeDeclarationFiles, RuleSupportsContext } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isReassignmentTarget, isObjectType, unionTypeParts } from 'tsutils';
import { isStrictNullChecksEnabled } from '../utils';

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
export class Rule extends TypedRule {
    public static supports(_sourceFile: ts.SourceFile, context: RuleSupportsContext) {
        return !ts.version.startsWith('2.4.') && isStrictNullChecksEnabled(context.program!.getCompilerOptions());
    }

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
            const info = this.getPropertyInfo(properties[i]);
            if (info.known && info.names.every((name) => propertiesSeen.has(name)))
                this.addFailureAtNode(properties[i], 'Property is overridden later.');
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
        const type = this.checker.getTypeAtLocation(node);
        return unionTypeParts(type).map(getPropertyInfoFromType).reduce(combinePropertyInfo);
    }

}
function getPropertyInfoFromType(type: ts.Type): PropertyInfo {
    if (!isObjectType(type))
        return emptyPropertyInfo;
    const result: PropertyInfo = {
        known: (type.flags & ts.TypeFlags.Any) !== 0 ||
            type.getStringIndexType() === undefined && type.getNumberIndexType() === undefined,
        names: [],
        assignedNames: [],
    };
    for (const prop of type.getProperties()) {
        if ((prop.flags & ts.SymbolFlags.Optional) === 0)
            result.assignedNames.push(prop.escapedName);
        result.names.push(prop.escapedName);
    }
    return result;
}

function combinePropertyInfo(a: PropertyInfo, b: PropertyInfo): PropertyInfo {
    return {
        known: a.known && b.known,
        names: [...a.names, ...b.names],
        assignedNames: a.assignedNames.filter((name) => b.assignedNames.includes(name)),
    };
}
