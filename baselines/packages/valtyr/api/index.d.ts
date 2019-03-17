import { ContainerModule } from 'inversify';
import { TslintFormatterLoaderHost } from './src/formatter-loader';
import { TslintRuleLoaderHost } from './src/rule-loader';
import { TslintLineSwitchParser } from './src/line-switches';
import { TslintConfigurationProvider } from './src/configuration-provider';
export { TslintFormatterLoaderHost, TslintRuleLoaderHost, TslintLineSwitchParser, TslintConfigurationProvider, };
export declare function createModule(): ContainerModule;
