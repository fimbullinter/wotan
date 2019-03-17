import { FormatterLoaderHost, FormatterConstructor, DirectoryService } from '@fimbul/ymir';
export declare class FormatterLoader {
    constructor(host: FormatterLoaderHost, directories: DirectoryService);
    loadFormatter(name: string): FormatterConstructor;
}
