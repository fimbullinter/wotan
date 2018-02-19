import * as ts from 'typescript';
import * as path from 'path';
import { Replacement } from '@fimbul/wotan';
import { isImportDeclaration } from 'tsutils';

export function getPackageName(fileName: string): string {
    const parts = splitPath(fileName);
    return parts[parts.lastIndexOf('packages') + 1];
}

export function splitPath(fileName: string) {
    return fileName.split(/[/\\]/);
}

export function createDirectImportFix(moduleSpecifier: ts.Expression, dirname: string, checker: ts.TypeChecker) {
    const declaration = moduleSpecifier.parent!;
    let fix: Replacement | undefined;
    if (isImportDeclaration(declaration) && declaration.importClause !== undefined &&
        declaration.importClause.namedBindings !== undefined &&
        declaration.importClause.namedBindings.kind === ts.SyntaxKind.NamedImports) {
        const map = new Map<string, string[]>();
        for (const binding of declaration.importClause.namedBindings.elements) {
            const symbol = checker.getAliasedSymbol(checker.getSymbolAtLocation(binding.name)!);
            if (symbol.valueDeclaration === undefined)
                continue;
            let {fileName} = symbol.valueDeclaration.getSourceFile();
            fileName = path.posix.relative(dirname, fileName);
            if (!fileName.startsWith('../'))
                fileName = './' + fileName;
            fileName = fileName.substring(0, fileName.length - path.extname(fileName).length);
            const importsFromFile = map.get(fileName);
            if (importsFromFile === undefined) {
                map.set(fileName, [binding.getText()]);
            } else {
                importsFromFile.push(binding.getText());
            }
        }
        if (map.size === 1) {
            fix = Replacement.replace(
                moduleSpecifier.getStart() + 1,
                moduleSpecifier.end - 1,
                map.keys().next().value,
            );
        } else {
            fix = Replacement.replace(
                declaration.getStart(),
                declaration.end,
                Array.from(map, toImportStatement).join('\n'),
            );
        }
    }
    return fix;
}

function toImportStatement([file, bindings]: [string, string[]]) {
    return `import { ${bindings.join(', ')} } from '${file}';`;
}
