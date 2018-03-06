import { RuleLoaderHost, RuleConstructor, BuiltinResolver } from '@fimbul/ymir';
import * as debug from 'debug';
import * as path from 'path';
import { injectable } from 'inversify';

const log = debug('wotan:ruleLoaderHost');

@injectable()
export class NodeRuleLoader implements RuleLoaderHost {
    constructor(private resolver: BuiltinResolver) {}

    public loadCoreRule(name: string): RuleConstructor | undefined {
        try {
            name = this.resolver.resolveRule(name);
            const rule = require(name).Rule;
            log('Found %s', name);
            return rule;
        } catch (e) {
            if (e != undefined && e.code === 'MODULE_NOT_FOUND')
                return;
            throw e;
        }
    }

    public loadCustomRule(name: string, directory: string): RuleConstructor | undefined {
        try {
            name = path.join(directory, name);
            const rule = require(name).Rule;
            log('Found %s', name);
            return rule;
        } catch (e) {
            if (e != undefined && e.code === 'MODULE_NOT_FOUND' && e.message === `Cannot find module '${name}'`)
                return;
            throw e;
        }
    }
}
