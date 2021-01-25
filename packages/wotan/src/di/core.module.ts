import { ContainerModule } from 'inversify';
import { CachedFileSystem } from '../services/cached-file-system';
import { ConfigurationManager } from '../services/configuration-manager';
import { FormatterLoader } from '../services/formatter-loader';
import { RuleLoader } from '../services/rule-loader';
import { Linter } from '../linter';
import { Runner } from '../runner';
import { ProcessorLoader } from '../services/processor-loader';
import { GlobalOptions } from '@fimbul/ymir';
import { ProgramStateFactory } from '../program-state';
import { StatePersistence } from '../state-persistence';
import { DependencyResolverFactory } from '../dependency-resolver';

export function createCoreModule(globalOptions: GlobalOptions) {
    return new ContainerModule((bind) => {
        bind(CachedFileSystem).toSelf();
        bind(ConfigurationManager).toSelf();
        bind(FormatterLoader).toSelf();
        bind(RuleLoader).toSelf();
        bind(ProcessorLoader).toSelf();
        bind(Linter).toSelf();
        bind(Runner).toSelf();
        bind(ProgramStateFactory).toSelf();
        bind(StatePersistence).toSelf(); // TODO allow overriding
        bind(DependencyResolverFactory).toSelf();
        bind(GlobalOptions).toConstantValue(globalOptions);
    });
}
