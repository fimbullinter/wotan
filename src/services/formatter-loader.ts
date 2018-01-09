import { injectable } from 'inversify';
import { FormatterLoaderHost, FormatterConstructor, DirectoryService } from '../types';
import { ConfigurationError } from '../error';

@injectable()
export class FormatterLoader {
    constructor(private host: FormatterLoaderHost, private directories: DirectoryService) {}
    public loadFormatter(name: string): FormatterConstructor {
        let formatter: FormatterConstructor | undefined;
        if (/^[a-zA-Z-]+$/.test(name))
            formatter = this.host.loadCoreFormatter(name);
        if (formatter === undefined)
            formatter = this.host.loadCustomFormatter(name, this.directories.getCurrentDirectory());
        if (formatter === undefined)
            throw new ConfigurationError(`Could not find formatter '${name}' relative to '${this.directories.getCurrentDirectory()}'.`);
        return formatter;
    }
}
