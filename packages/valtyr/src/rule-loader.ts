import { injectable } from 'inversify';
import { RuleLoaderHost, RuleConstructor } from '@fimbul/wotan';
import * as TSLint from 'tslint';
import { wrapTslintRule } from '@fimbul/bifrost';

@injectable()
export class TslintRuleLoaderHost implements RuleLoaderHost {
    public loadCoreRule(name: string): RuleConstructor | undefined {
        const rule = TSLint.findRule(name);
        return rule === undefined ? undefined : wrapTslintRule(rule, name);
    }
    public loadCustomRule(name: string, dir: string): RuleConstructor | undefined {
        const rule = TSLint.findRule(name, dir);
        return rule === undefined ? undefined : wrapTslintRule(rule, name);
    }
}
