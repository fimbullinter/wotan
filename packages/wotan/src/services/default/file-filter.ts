import { injectable } from 'inversify';
import { FileFilterFactory, FileFilterContext, FileFilter } from '@fimbul/ymir';
import * as ts from 'typescript';
import { unixifyPath, mapDefined, addUnique } from '../../utils';
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
        if (this.options.composite)
            return this.rootNames.includes(fileName);
        if (this.program.isSourceFileFromExternalLibrary(file))
            return false;
        if (!fileName.endsWith('.d.ts'))
            return !fileName.endsWith('.json');
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
        if (this.outputsOfReferencedProjects === undefined)
            this.outputsOfReferencedProjects = getOutputsOfProjectReferences(this.program);
        return this.outputsOfReferencedProjects.includes(fileName);
    }
}

function getOutputsOfProjectReferences(program: ts.Program) {
    const references = program.getResolvedProjectReferences();
    if (references === undefined)
        return [];
    const seen: string[] = [];
    const result = [];
    for (const ref of references) {
        if (ref === undefined || !addUnique(seen, ref.sourceFile.fileName))
            continue;
        result.push(...getOutputFileNamesOfProjectReference(path.dirname(ref.sourceFile.fileName), ref.commandLine));
        result.push(...getOutputFileNamesOfResolvedProjectReferencesRecursive(ref.references, seen));
    }
    return result;
}

// TODO unifiy with code in getOutputsOfProjectReferences once we can get rid of getOutputFileNamesOfProjectReferenceRecursive
function getOutputFileNamesOfResolvedProjectReferencesRecursive(references: ts.ResolvedProjectReference['references'], seen: string[]) {
    if (references === undefined)
        return [];
    const result: string[] = [];
    for (const ref of references) {
        if (ref === undefined || !addUnique(seen, ref.sourceFile.fileName))
            continue;
        result.push(...getOutputFileNamesOfProjectReference(path.dirname(ref.sourceFile.fileName), ref.commandLine));
        result.push(...getOutputFileNamesOfResolvedProjectReferencesRecursive(ref.references, seen));
    }
    return result;
}

function getOutputFileNamesOfProjectReference(projectDirectory: string, commandLine: ts.ParsedCommandLine) {
    const options = commandLine.options;
    if (options.outFile)
        return [getOutFileDeclarationName(options.outFile)];
    return mapDefined(commandLine.fileNames, (fileName) => getDeclarationOutputName(fileName, options, projectDirectory));
}

// TODO remove once https://github.com/Microsoft/TypeScript/issues/26410 is resolved
function getDeclarationOutputName(fileName: string, options: ts.CompilerOptions, projectDirectory: string) {
    const extension = path.extname(fileName);
    switch (extension) {
        case '.tsx':
            break;
        case '.ts':
            if (path.extname(fileName.slice(0, -extension.length)) !== '.d')
                break;
            // falls through: .d.ts files produce no output
        default:
            return;
    }
    fileName = fileName.slice(0, -extension.length) + '.d.ts';
    return unixifyPath(
        path.resolve(
            options.declarationDir || options.outDir || projectDirectory,
            path.relative(options.rootDir || projectDirectory, fileName),
        ),
    );
}

function getOutFileDeclarationName(outFile: string) {
    // outFile ignores declarationDir
    return outFile.slice(0, -path.extname(outFile).length) + '.d.ts';
}
