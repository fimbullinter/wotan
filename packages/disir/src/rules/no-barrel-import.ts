import { AbstractRule } from '@fimbul/wotan';
import { findImports, ImportKind } from 'tsutils';
import * as ts from 'typescript';
import * as path from 'path';
import { getPackageName, splitPath, createDirectImportFix } from '../util';

export class Rule extends AbstractRule {
    public apply() {
        const dirname = path.dirname(this.sourceFile.fileName);
        const currentPackage = getPackageName(dirname);
        for (const name of findImports(this.sourceFile, ImportKind.AllStaticImports | ImportKind.ExportFrom)) {
            if (!ts.isExternalModuleNameRelative(name.text))
                continue;
            const parts = splitPath(path.resolve(dirname, name.text));
            const packageIndex = parts.lastIndexOf('packages') + 1;
            if (currentPackage === parts[packageIndex] &&
                (parts.length === packageIndex + 1 || parts.length === packageIndex + 2 && parts[packageIndex + 1] === 'index')) {
                const start = name.getStart(this.sourceFile);
                this.addFailure(
                    start,
                    name.end,
                    'Import directly from the module containing the declaration instead of the barrel.',
                    this.program !== undefined ? createDirectImportFix(name, dirname, this.program.getTypeChecker()) : undefined,
                );
            }
        }
    }
}
