import { ContainerModule } from 'inversify';
import {
    FormatterLoaderHost,
    RuleLoaderHost,
    Resolver,
    CacheFactory,
    FileSystem,
    MessageHandler,
    DirectoryService,
    DeprecationHandler,
    ConfigurationProvider,
    FindingFilterFactory,
    LineSwitchParser,
    BuiltinResolver,
    FileFilterFactory,
    StatePersistence,
} from '@fimbul/ymir';
import { NodeFormatterLoader } from '../services/default/formatter-loader-host';
import { NodeRuleLoader } from '../services/default/rule-loader-host';
import { NodeResolver } from '../services/default/resolver';
import { DefaultCacheFactory } from '../services/default/cache-factory';
import { NodeFileSystem } from '../services/default/file-system';
import { ConsoleMessageHandler } from '../services/default/message-handler';
import { NodeDirectoryService } from '../services/default/directory-service';
import { DefaultDeprecationHandler } from '../services/default/deprecation-handler';
import { DefaultConfigurationProvider } from '../services/default/configuration-provider';
import { DefaultLineSwitchParser, LineSwitchFilterFactory } from '../services/default/line-switches';
import { DefaultBuiltinResolver } from '../services/default/builtin-resolver';
import { DefaultFileFilterFactory } from '../services/default/file-filter';
import { DefaultStatePersistence } from '../services/default/state-persistence';

export function createDefaultModule() {
    return new ContainerModule((bind, _unbind, isBound) => {
        if (!isBound(FormatterLoaderHost))
            bind(FormatterLoaderHost).to(NodeFormatterLoader);
        if (!isBound(RuleLoaderHost))
            bind(RuleLoaderHost).to(NodeRuleLoader);
        if (!isBound(Resolver))
            bind(Resolver).to(NodeResolver);
        if (!isBound(CacheFactory))
            bind(CacheFactory).to(DefaultCacheFactory);
        if (!isBound(FileSystem))
            bind(FileSystem).to(NodeFileSystem);
        if (!isBound(MessageHandler))
            bind(MessageHandler).to(ConsoleMessageHandler);
        if (!isBound(DeprecationHandler))
            bind(DeprecationHandler).to(DefaultDeprecationHandler);
        if (!isBound(DirectoryService))
            bind(DirectoryService).to(NodeDirectoryService);
        if (!isBound(ConfigurationProvider))
            bind(ConfigurationProvider).to(DefaultConfigurationProvider);
        if (!isBound(FindingFilterFactory))
            bind(FindingFilterFactory).to(LineSwitchFilterFactory);
        if (!isBound(LineSwitchParser))
            bind(LineSwitchParser).to(DefaultLineSwitchParser);
        if (!isBound(BuiltinResolver))
            bind(BuiltinResolver).to(DefaultBuiltinResolver);
        if (!isBound(FileFilterFactory))
            bind(FileFilterFactory).to(DefaultFileFilterFactory);
        if (!isBound(StatePersistence))
            bind(StatePersistence).to(DefaultStatePersistence);
    });
}
