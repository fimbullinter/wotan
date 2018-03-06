import { injectable } from 'inversify';
import { FormatterLoaderHost, FormatterConstructor, Resolver, BuiltinResolver } from '@fimbul/ymir';
import { OFFSET_TO_NODE_MODULES } from '../../utils';

@injectable()
export class NodeFormatterLoader implements FormatterLoaderHost {
    constructor(private resolver: Resolver, private builtinResolver: BuiltinResolver) {}

    public loadCoreFormatter(name: string): FormatterConstructor | undefined {
        name = this.builtinResolver.resolveFormatter(name);
        try {
            return require(name).Formatter;
        } catch (e) {
            if (e != undefined && e.code === 'MODULE_NOT_FOUND' && e.message === `Cannot find module '${name}'`)
                return;
            throw e;
        }
    }
    public loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined {
        let resolved: string;
        try {
            resolved = this.resolver.resolve(
                name,
                basedir,
                Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
                module.paths.slice(OFFSET_TO_NODE_MODULES + 1),
            );
        } catch {
            return;
        }
        return this.resolver.require(resolved).Formatter;
    }
}
