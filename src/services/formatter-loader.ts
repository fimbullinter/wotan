import { injectable } from 'inversify';
import { FormatterLoaderHost, FormatterConstructor } from '../types';
import { ConfigurationError } from '../error';

@injectable()
export class FormatterLoader {
    constructor(private host: FormatterLoaderHost) {}
    public loadFormatter(name: string, basedir: string): FormatterConstructor {
        let formatter: FormatterConstructor | undefined;
        if (/^[a-zA-Z]+$/.test(name))
            formatter = this.host.loadCoreFormatter(name);
        if (formatter === undefined)
            formatter = this.host.loadCustomFormatter(name, basedir);
        if (formatter === undefined)
            throw new ConfigurationError(`Could not find formatter '${name}' relative to '${basedir}'.`);
        return formatter;
    }
}
