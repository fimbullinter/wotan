import {
    NodeFormatterLoader,
    Resolver,
    FormatterConstructor,
    NodeRuleLoader,
    RuleConstructor,
    FormatterLoaderHost,
    RuleLoaderHost,
} from '@fimbul/wotan';
import { wrapTslintFormatter, wrapTslintRule } from '@fimbul/bifrost';
import * as TSLint from 'tslint';
import { injectable, ContainerModule } from 'inversify';

@injectable()
export class TslintFormatterLoaderHost extends NodeFormatterLoader {
    constructor(resolver: Resolver) {
        super(resolver);
    }

    public loadCustomFormatter(name: string, basedir: string): FormatterConstructor | undefined {
        const result = super.loadCustomFormatter(name, basedir);
        if (result !== undefined)
            return result;
        const tslintFormatter = TSLint.findFormatter(name);
        return tslintFormatter && wrapTslintFormatter(tslintFormatter);
    }
}

@injectable()
export class TslintRuleLoaderHost extends NodeRuleLoader {
    public loadCustomRule(name: string, dir: string): RuleConstructor | undefined {
        const rule = super.loadCustomRule(name, dir);
        if (rule !== undefined)
            return rule;
        const tslintRule = TSLint.findRule(name, dir);
        return tslintRule && wrapTslintRule(tslintRule, name);
    }
}

export const module = new ContainerModule((bind) => {
    bind(FormatterLoaderHost).to(TslintFormatterLoaderHost);
    bind(RuleLoaderHost).to(TslintRuleLoaderHost);
});
