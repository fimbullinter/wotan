import { ContainerModule } from 'inversify';
import { RuleLoaderHost, FormatterLoaderHost } from '../types';

// tslint:disable:no-require-imports

export const TSLINT_COMPAT_MODULE = new ContainerModule((bind) => {
    bind(RuleLoaderHost).to(require('../services/tslint-compat/rule-loader-host').TslintRuleLoader);
    bind(FormatterLoaderHost).to(require('../services/tslint-compat/formatter-loader-host').TslintFormatterLoader);
});
