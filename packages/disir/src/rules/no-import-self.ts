import { AbstractRule, Replacement } from '@fimbul/wotan';
import { findImports, ImportKind, isImportDeclaration } from 'tsutils';
import { getPackageName } from '../util';
import * as ts from 'typescript';
import * as path from 'path';

export class Rule extends AbstractRule {
    public apply() {
        const dirname = path.dirname(this.sourceFile.fileName);
        const currentPackage = `@fimbul/${getPackageName(dirname)}`;
        for (const name of findImports(this.sourceFile, ImportKind.AllStaticImports | ImportKind.ExportFrom)) {
            if (name.text === currentPackage) {
                let fix: Replacement | undefined;
                if (this.program !== undefined) {
                    const declaration = name.parent!;
                    const checker = this.program.getTypeChecker();
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
                            if (!fileName.startsWith('.'))
                                fileName = './' + fileName;
                            const importsFromFile = map.get(fileName);
                            if (importsFromFile === undefined) {
                                map.set(fileName, [binding.getText(this.sourceFile)]);
                            } else {
                                importsFromFile.push(binding.getText(this.sourceFile));
                            }
                        }
                        if (map.size === 1) {
                            fix = Replacement.replace(
                                name.getStart(this.sourceFile) + 1,
                                name.end - 1,
                                map.keys().next().value,
                            );
                        } else {
                            fix = Replacement.replace(
                                declaration.getStart(this.sourceFile),
                                declaration.end,
                                Array.from(map, toImportStatement).join('\n'),
                            );
                        }
                    }
                }
                this.addFailureAtNode(
                    name,
                    `Import directly from the module containing the declaration instead of '${currentPackage}'.`,
                    fix,
                );
            }
        }
    }
}

function toImportStatement([file, bindings]: [string, string[]]) {
    return `import { ${bindings.join(', ')} } from '${file}';`;
}
