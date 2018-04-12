import { TypedRule, excludeDeclarationFiles } from '@fimbul/ymir';
import * as ts from 'typescript';
import { isReassignmentTarget, isObjectType, unionTypeParts } from 'tsutils';

@excludeDeclarationFiles
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
                const name = this.getPropertyName(property.name);
                if (name === undefined)
                    return {
                        known: false,
                        names: [],
                        assignedNames: [],
                    };
                return {
                    known: true,
                    names: [name],
                    assignedNames: [name],
                };
            }
        }
    }

    private getPropertyName(node: ts.PropertyName): ts.__String | undefined {
        const symbol = this.checker.getSymbolAtLocation(node);
        return symbol && symbol.escapedName;
    }

    private getPropertyInfoFromSpread(node: ts.Expression): PropertyInfo {
        const type = this.checker.getTypeAtLocation(node);
        return unionTypeParts(type).map((t) => this.getPropertyInfoFromType(t, node)).reduce(combinePropertyInfo);
    }

    private getPropertyInfoFromType(type: ts.Type, node: ts.Expression): PropertyInfo {
        if (!isObjectType(type))
            return {
                known: false,
                names: [],
                assignedNames: [],
            };
        const result: PropertyInfo = {
            known: (type.flags & ts.TypeFlags.Any) !== 0 ||
                type.getStringIndexType() === undefined && type.getNumberIndexType() === undefined,
            names: [],
            assignedNames: [],
        };
        for (const prop of type.getProperties()) {
            if (!unionTypeParts(this.checker.getTypeOfSymbolAtLocation(prop, node)).some(isOptionalType))
                result.assignedNames.push(prop.escapedName);
            result.names.push(prop.escapedName);
        }
        return result;
    }
}

function combinePropertyInfo(a: PropertyInfo, b: PropertyInfo): PropertyInfo {
    return {
        known: a.known && b.known,
        names: [...a.names, ...b.names],
        assignedNames: a.assignedNames.filter((name) => b.assignedNames.includes(name)),
    };
}

function isOptionalType(type: ts.Type) {
    return (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Any)) !== 0;
}

interface PropertyInfo {
    known: boolean;
    names: ts.__String[];
    assignedNames: ts.__String[];
}
