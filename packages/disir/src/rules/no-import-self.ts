import { AbstractRule } from '@fimbul/wotan';
import { findImports, ImportKind } from 'tsutils';
import { getPackageName, createDirectImportFix } from '../util';
import * as path from 'path';

export class Rule extends AbstractRule {
    public apply() {
        const dirname = path.dirname(this.sourceFile.fileName);
        const currentPackage = `@fimbul/${getPackageName(dirname)}`;
        for (const name of findImports(this.sourceFile, ImportKind.AllStaticImports | ImportKind.ExportFrom))
            if (name.text === currentPackage)
                this.addFailureAtNode(
                    name,
                    `Import directly from the module containing the declaration instead of '${currentPackage}'.`,
                    this.program !== undefined ? createDirectImportFix(name, dirname, this.program.getTypeChecker()) : undefined,
                );
    }
}
