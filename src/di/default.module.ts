import { ContainerModule } from 'inversify';
import { FormatterLoaderHost, RuleLoaderHost, Resolver, CacheManager, FileSystemReader, MessageHandler } from '../types';
import { NodeFormatterLoader } from '../services/formatter-loader-host';
import { NodeRuleLoader } from '../services/rule-loader-host';
import { NodeResolver } from '../services/resolver';
import { DefaultCacheManager } from '../services/cache-manager';
import { NodeFileSystemReader } from '../services/file-system-reader';
import { ConsoleMessageHandler } from '../services/message-handler';

export const DEFAULT_DI_MODULE = new ContainerModule((bind) => {
    bind(FormatterLoaderHost).to(NodeFormatterLoader);
    bind(RuleLoaderHost).to(NodeRuleLoader);
    bind(Resolver).to(NodeResolver);
    bind(CacheManager).to(DefaultCacheManager);
    bind(FileSystemReader).to(NodeFileSystemReader);
    bind(MessageHandler).to(ConsoleMessageHandler);
});
