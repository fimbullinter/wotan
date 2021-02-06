import { injectable } from 'inversify';
import { FileFilterFactory, FileFilterContext, FileFilter } from '@fimbul/ymir';
import * as ts from 'typescript';
import { unixifyPath, getOutputFileNamesOfProjectReference, iterateProjectReferences, flatMap } from '../../utils';
import * as path from 'path';

@injectable()
export class DefaultFileFilterFactory implements FileFilterFactory {
    public create(context: FileFilterContext) {
        return new DefaultFileFilter(context.program, context.host);
    }
}

class DefaultFileFilter implements FileFilter {
    private rootNames = this.program.getRootFileNames();
    private options = this.program.getCompilerOptions();
    private libDirectory = unixifyPath(path.dirname(ts.getDefaultLibFilePath(this.options))) + '/';
    private typeRoots: ReadonlyArray<string> | undefined = undefined;
    private outputsOfReferencedProjects: ReadonlyArray<string> | undefined = undefined;

    constructor(private program: ts.Program, private host: FileFilterContext['host']) {}

    public filter(file: ts.SourceFile) {
        const {fileName} = file;
        if (fileName.endsWith('.json'))
            return false;
        if (this.options.composite)
            return this.rootNames.includes(fileName);
        if (this.program.isSourceFileFromExternalLibrary(file))
            return false;
        if (!fileName.endsWith('.d.ts'))
            return true;
        if (
            // lib.xxx.d.ts
            fileName.startsWith(this.libDirectory) ||
            // tslib implicitly gets added while linting a project where a dependency in node_modules contains typescript files
            fileName.endsWith('/node_modules/tslib/tslib.d.ts')
        )
            return false; // lib.xxx.d.ts
        return !this.isInTypeRoot(fileName) && !this.isOutputOfReferencedProject(fileName);
    }

    private isInTypeRoot(fileName: string) {
        if (this.typeRoots === undefined)
            this.typeRoots = ts.getEffectiveTypeRoots(this.options, {
                directoryExists: (dir) => this.host.directoryExists(dir),
                getCurrentDirectory: () => this.program.getCurrentDirectory(),
            }) || [];
        return !this.typeRoots.every((typeRoot) => path.relative(typeRoot, fileName).startsWith('..' + path.sep));
    }

    private isOutputOfReferencedProject(fileName: string) {
        this.outputsOfReferencedProjects ??= flatMap(
            iterateProjectReferences(this.program.getResolvedProjectReferences()),
            getOutputFileNamesOfProjectReference,
        );
        return this.outputsOfReferencedProjects.includes(fileName);
    }
}
