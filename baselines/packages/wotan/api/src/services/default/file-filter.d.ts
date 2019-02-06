import { FileFilterFactory, FileFilterContext, FileFilter } from '@fimbul/ymir';
import * as ts from 'typescript';
export declare class DefaultFileFilterFactory implements FileFilterFactory {
    create(context: FileFilterContext): DefaultFileFilter;
}
declare class DefaultFileFilter implements FileFilter {
    private program;
    private host;
    private rootNames;
    private options;
    private libDirectory;
    private typeRoots;
    private outputsOfReferencedProjects;
    constructor(program: ts.Program, host: FileFilterContext['host']);
    filter(file: ts.SourceFile): boolean;
    private isInTypeRoot;
    private isOutputOfReferencedProject;
}
export {};
