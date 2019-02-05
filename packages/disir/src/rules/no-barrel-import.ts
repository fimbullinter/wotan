import { AbstractRule } from '@fimbul/ymir';
import { findImports, ImportKind } from 'tsutils';
import * as ts from 'typescript';
import * as path from 'path';
import { createDirectImportFix } from '../util';

export class Rule extends AbstractRule {
    public apply() {
        const dirname = path.dirname(this.sourceFile.fileName);
        for (const name of findImports(this.sourceFile, ImportKind.AllStaticImports | ImportKind.ExportFrom)) {
            if (!ts.isExternalModuleNameRelative(name.text))
                continue;
            let resolved = path.resolve(dirname, name.text);
            if (path.basename(resolved) === 'index')
                resolved = path.dirname(resolved);
            if (!path.relative(resolved, this.sourceFile.fileName).startsWith('..')) {
                const start = name.getStart(this.sourceFile);
                this.addFinding(
                    start,
                    name.end,
                    'Import directly from the module containing the declaration instead of the barrel.',
                    this.program !== undefined ? createDirectImportFix(name, dirname, this.program.getTypeChecker()) : undefined,
                );
            }
        }
    }
}
