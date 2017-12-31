import { ContainerModule } from 'inversify';
import {
    FormatterLoaderHost,
    RuleLoaderHost,
    Resolver,
    CacheManager,
    FileSystemReader,
    MessageHandler,
    CurrentDirectory,
    HomeDirectory,
} from '../types';
import { NodeFormatterLoader } from '../services/formatter-loader-host';
import { NodeRuleLoader } from '../services/rule-loader-host';
import { NodeResolver } from '../services/resolver';
import { DefaultCacheManager } from '../services/cache-manager';
import { NodeFileSystemReader } from '../services/file-system-reader';
import { ConsoleMessageHandler } from '../services/message-handler';
import * as os from 'os';

export const DEFAULT_DI_MODULE = new ContainerModule((bind, _unbind, isBound) => {
    if (!isBound(FormatterLoaderHost))
        bind(FormatterLoaderHost).to(NodeFormatterLoader);
    if (!isBound(RuleLoaderHost))
        bind(RuleLoaderHost).to(NodeRuleLoader);
    if (!isBound(Resolver))
        bind(Resolver).to(NodeResolver);
    if (!isBound(CacheManager))
        bind(CacheManager).to(DefaultCacheManager);
    if (!isBound(FileSystemReader))
        bind(FileSystemReader).to(NodeFileSystemReader);
    if (!isBound(MessageHandler))
        bind(MessageHandler).to(ConsoleMessageHandler);
    if (!isBound(CurrentDirectory))
        bind(CurrentDirectory).toDynamicValue(process.cwd).inSingletonScope();
    if (!isBound(HomeDirectory))
        bind(HomeDirectory).toDynamicValue(os.homedir).inSingletonScope();
});
