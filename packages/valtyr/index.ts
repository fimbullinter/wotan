import { FormatterLoaderHost, RuleLoaderHost, LineSwitchParser, ConfigurationProvider } from '@fimbul/wotan';
import { ContainerModule } from 'inversify';
import { TslintFormatterLoaderHost } from './src/formatter-loader';
import { TslintRuleLoaderHost } from './src/rule-loader';
import { TslintLineSwitchParser } from './src/line-switches';
import { TslintConfigurationProvider } from './src/configuration-provider';

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
