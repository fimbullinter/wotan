import { ContainerModule, Container, interfaces } from 'inversify';
import { CachedFileSystem } from '../services/cached-file-system';
import { ConfigurationManager } from '../services/configuration-manager';
import { FormatterLoader } from '../services/formatter-loader';
import { RuleLoader } from '../services/rule-loader';
import { Linter } from '../linter';
import { Runner } from '../runner';
import { ProcessorLoader } from '../services/processor-loader';
import { RuleTester } from '../test';
import { LineSwitchService } from '../services/line-switches';

export const CORE_DI_MODULE = new ContainerModule((bind) => {
    bind(CachedFileSystem).toSelf();
    bind(ConfigurationManager).toSelf();
    bind(FormatterLoader).toSelf();
    bind(RuleLoader).toSelf();
    bind(ProcessorLoader).toSelf();
    bind(Linter).toSelf();
    bind(Runner).toSelf();
    bind(RuleTester).toSelf();
    bind(LineSwitchService).toSelf();
    bind<interfaces.Container>(Container).toDynamicValue((context) => context.container);
});
