import { ContainerModule, Container, interfaces } from 'inversify';
import { CachedFileSystem } from '../services/cached-file-system';
import { ConfigurationManager } from '../services/configuration-manager';
import { FormatterLoader } from '../services/formatter-loader';
import { RuleLoader } from '../services/rule-loader';
import { Linter } from '../linter';
import { Runner } from '../runner';
import { ProcessorLoader } from '../services/processor-loader';

export const CORE_DI_MODULE = new ContainerModule((bind) => {
    bind(CachedFileSystem).toSelf();
    bind(ConfigurationManager).toSelf();
    bind(FormatterLoader).toSelf();
    bind(RuleLoader).toSelf();
    bind(ProcessorLoader).toSelf();
    bind(Linter).toSelf();
    bind(Runner).toSelf();
    bind<interfaces.Container>(Container).toDynamicValue((context) => context.container);
});
