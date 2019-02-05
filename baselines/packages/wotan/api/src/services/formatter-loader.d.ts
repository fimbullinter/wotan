import { FormatterLoaderHost, FormatterConstructor, DirectoryService } from '@fimbul/ymir';
export declare class FormatterLoader {
    private host;
    private directories;
    constructor(host: FormatterLoaderHost, directories: DirectoryService);
    loadFormatter(name: string): FormatterConstructor;
}
