import { RuleLoaderHost, RuleConstructor } from '../../types';
import * as debug from 'debug';
import * as path from 'path';
import { injectable } from 'inversify';

const log = debug('wotan:ruleLoaderHost');

const CORE_RULES_DIRECTORY = path.join(__dirname, '../../rules');

@injectable()
export class NodeRuleLoader implements RuleLoaderHost {
    public loadCoreRule(name: string): RuleConstructor | undefined {
        try {
            name = path.join(CORE_RULES_DIRECTORY, name + '.js');
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
            if (e != undefined && e.code === 'MODULE_NOT_FOUND')
                return;
            throw e;
        }
    }
}
