import { injectable } from 'inversify';
import { FormatterLoaderHost, FormatterConstructor, Resolver, BuiltinResolver } from '@fimbul/ymir';
import { OFFSET_TO_NODE_MODULES } from '../../utils';

@injectable()
export class NodeFormatterLoader implements FormatterLoaderHost {
    constructor(private resolver: Resolver, private builtinResolver: BuiltinResolver) {}

    public loadCoreFormatter(name: string): FormatterConstructor | undefined {
        name = this.builtinResolver.resolveFormatter(name);
        try {
            name = this.resolver.resolve(name);
        } catch {
            return;
        }
        return this.resolver.require(name).Formatter;
    }
    public loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined {
        try {
            name = this.resolver.resolve(name, basedir, undefined, module.paths.slice(OFFSET_TO_NODE_MODULES + 2));
        } catch {
            return;
        }
        return this.resolver.require(name).Formatter;
    }
}
