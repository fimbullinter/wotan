import { FileFilterFactory, FileFilterContext, FileFilter } from '@fimbul/ymir';
import * as ts from 'typescript';
export declare class DefaultFileFilterFactory implements FileFilterFactory {
    create(context: FileFilterContext): DefaultFileFilter;
}
declare class DefaultFileFilter implements FileFilter {
    constructor(program: ts.Program, host: FileFilterContext['host']);
    filter(file: ts.SourceFile): boolean;
}
export {};
