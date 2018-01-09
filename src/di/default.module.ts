import { ContainerModule } from 'inversify';
import {
    FormatterLoaderHost,
    RuleLoaderHost,
    Resolver,
    CacheManager,
    FileSystem,
    MessageHandler,
    DirectoryService,
    DeprecationHandler,
} from '../types';
import { NodeFormatterLoader } from '../services/default/formatter-loader-host';
import { NodeRuleLoader } from '../services/default/rule-loader-host';
import { NodeResolver } from '../services/default/resolver';
import { DefaultCacheManager } from '../services/default/cache-manager';
import { NodeFileSystem } from '../services/default/file-system';
import { ConsoleMessageHandler } from '../services/default/message-handler';
import { NodeDirectoryService } from '../services/default/directory-service';
import { DefaultDeprecationHandler } from '../services/default/deprecation-handler';

export const DEFAULT_DI_MODULE = new ContainerModule((bind, _unbind, isBound) => {
    if (!isBound(FormatterLoaderHost))
        bind(FormatterLoaderHost).to(NodeFormatterLoader);
    if (!isBound(RuleLoaderHost))
        bind(RuleLoaderHost).to(NodeRuleLoader);
    if (!isBound(Resolver))
        bind(Resolver).to(NodeResolver);
    if (!isBound(CacheManager))
        bind(CacheManager).to(DefaultCacheManager);
    if (!isBound(FileSystem))
        bind(FileSystem).to(NodeFileSystem);
    if (!isBound(MessageHandler))
        bind(MessageHandler).to(ConsoleMessageHandler);
    if (!isBound(DeprecationHandler))
        bind(DeprecationHandler).to(DefaultDeprecationHandler);
    if (!isBound(DirectoryService))
        bind(DirectoryService).to(NodeDirectoryService);
});
