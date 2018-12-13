import { RuleLoaderHost, RuleConstructor, BuiltinResolver, Resolver } from '@fimbul/ymir';
import * as debug from 'debug';
import * as path from 'path';
import { injectable } from 'inversify';

const log = debug('wotan:ruleLoaderHost');

@injectable()
export class NodeRuleLoader implements RuleLoaderHost {
    constructor(private builtinResolver: BuiltinResolver, private resolver: Resolver) {}

    public loadCoreRule(name: string): RuleConstructor | undefined {
        name = this.builtinResolver.resolveRule(name);
        try {
            name = this.resolver.resolve(name);
        } catch {
            return;
        }
        log('Found %s', name);
        return this.resolver.require(name).Rule;
    }

    public loadCustomRule(name: string, directory: string): RuleConstructor | undefined {
        try {
            name = this.resolver.resolve(path.join(directory, name), directory);
        } catch {
            return;
        }
        log('Found %s', name);
        return this.resolver.require(name).Rule;
    }
}
