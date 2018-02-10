import { FormatterLoaderHost, RuleLoaderHost, LineSwitchParser, ConfigurationProvider } from '@fimbul/wotan';
import { ContainerModule } from 'inversify';
import { TslintFormatterLoaderHost } from './formatter-loader';
import { TslintRuleLoaderHost } from './rule-loader';
import { TslintLineSwitchParser } from './line-switches';
import { TslintConfigurationProvider } from './configuration-provider';

export {
    TslintFormatterLoaderHost,
    TslintRuleLoaderHost,
    TslintLineSwitchParser,
    TslintConfigurationProvider,
};

export const module = new ContainerModule((bind) => {
    bind(FormatterLoaderHost).to(TslintFormatterLoaderHost);
    bind(RuleLoaderHost).to(TslintRuleLoaderHost);
    bind(LineSwitchParser).to(TslintLineSwitchParser);
    bind(ConfigurationProvider).to(TslintConfigurationProvider);
});
