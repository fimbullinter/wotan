import { injectable, inject } from 'inversify';
import { FormatterLoaderHost, FormatterConstructor, CurrentDirectory } from '../types';
import { ConfigurationError } from '../error';

@injectable()
export class FormatterLoader {
    constructor(private host: FormatterLoaderHost, @inject(CurrentDirectory) private cwd: string) {}
    public loadFormatter(name: string): FormatterConstructor {
        let formatter: FormatterConstructor | undefined;
        if (/^[a-zA-Z]+$/.test(name))
            formatter = this.host.loadCoreFormatter(name);
        if (formatter === undefined)
            formatter = this.host.loadCustomFormatter(name, this.cwd);
        if (formatter === undefined)
            throw new ConfigurationError(`Could not find formatter '${name}' relative to '${this.cwd}'.`);
        return formatter;
    }
}
