import { TypedRule, excludeDeclarationFiles, requiresCompilerOption } from '@fimbul/ymir';
import * as ts from 'typescript';
import {
    isReassignmentTarget,
    isObjectType,
    isClassLikeDeclaration,
    isIntersectionType,
    isUnionType,
    getLateBoundPropertyNamesOfPropertyName,
} from 'tsutils';

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
@requiresCompilerOption('strictNullChecks')
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
        /** key: propertyName, value: isAccessor */
        const propertiesSeen = new Map<ts.__String, boolean>();
        for (let i = properties.length - 1; i >= 0; --i) {
            const property = properties[i];
            const info = this.getPropertyInfo(property);
            const isAccessor = property.kind === ts.SyntaxKind.GetAccessor || property.kind === ts.SyntaxKind.SetAccessor;
            if (info.known && info.names.every((name) => isAccessor ? propertiesSeen.get(name) === false : propertiesSeen.has(name))) {
                if (property.kind === ts.SyntaxKind.SpreadAssignment) {
                    this.addFindingAtNode(property, 'All properties of this object are overridden later.');
                } else {
                    this.addFindingAtNode(property.name, `Property '${property.name.getText(this.sourceFile)}' is overridden later.`);
                    if (isAccessor)
                        continue; // avoid overriding the isAccessor state
                }
            }
            for (const name of info.assignedNames)
                propertiesSeen.set(name, isAccessor);
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
                const lateBound = getLateBoundPropertyNamesOfPropertyName(property.name, this.checker);
                if (!lateBound.known)
                    return emptyPropertyInfo;
                const names = lateBound.names.map((p) => p.symbolName);
                return {
                    names,
                    known: true,
                    assignedNames: names.length !== 1 ? [] : names, // if the computed name is a union, it's not sure which will be assigned
                };
            }
        }
    }

    private getPropertyInfoFromSpread(node: ts.Expression): PropertyInfo {
        return getPropertyInfoFromType(this.checker.getTypeAtLocation(node)!);
    }
}

function getPropertyInfoFromType(type: ts.Type): PropertyInfo {
    if (isUnionType(type))
        return type.types.map(getPropertyInfoFromType).reduce(unionPropertyInfo);
    if (isIntersectionType(type))
        return type.types.map(getPropertyInfoFromType).reduce(intersectPropertyInfo);
    if (type.flags & ts.TypeFlags.Instantiable) {
        const constraint = type.getConstraint();
        if (constraint === undefined)
            return emptyPropertyInfo;
        return {...getPropertyInfoFromType(constraint), known: false};
    }
    if (!isObjectType(type))
        return emptyPropertyInfo;
    const result: PropertyInfo = {
        known: type.getStringIndexType() === undefined && type.getNumberIndexType() === undefined,
        names: [],
        assignedNames: [],
    };
    for (const prop of type.getProperties()) {
        if (!isSpreadableProperty(prop))
            continue;
        if ((prop.flags & ts.SymbolFlags.Optional) === 0)
            result.assignedNames.push(prop.escapedName);
        result.names.push(prop.escapedName);
    }
    return result;
}
function isSpreadableProperty(prop: ts.Symbol): boolean | undefined {
    if (prop.flags & (ts.SymbolFlags.Method | ts.SymbolFlags.Accessor))
        for (const declaration of prop.declarations!)
            if (isClassLikeDeclaration(declaration.parent!))
                return false;
    return true;
}

function unionPropertyInfo(a: PropertyInfo, b: PropertyInfo): PropertyInfo {
    return {
        known: a.known && b.known,
        names: [...a.names, ...b.names],
        assignedNames: a.assignedNames.filter((name) => b.assignedNames.includes(name)),
    };
}

function intersectPropertyInfo(a: PropertyInfo, b: PropertyInfo): PropertyInfo {
    return {
        known: a.known && b.known,
        names: [...a.names, ...b.names],
        assignedNames: [...a.assignedNames, ...b.assignedNames],
    };
}
