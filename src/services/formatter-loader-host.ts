import { injectable } from 'inversify';
import { FormatterLoaderHost, FormatterConstructor } from '../types';
import { resolveExecutable } from '../utils';

@injectable()
export class NodeFormatterLoader implements FormatterLoaderHost {
    public loadCoreFormatter(name: string): FormatterConstructor | undefined {
        try {
            return require(`../formatters/${name}.js`).Formatter;
        } catch (e) {
            if (e != undefined && e.code === 'MODULE_NOT_FOUND')
                return;
            throw e;
        }
    }
    public loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined {
        let resolved: string;
        try {
            resolved = resolveExecutable(name, basedir); // TODO use Resolver
        } catch {
            return;
        }
        return require(resolved).Formatter;
    }
}
