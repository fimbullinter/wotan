import { ConfigurationProvider, Resolver, Configuration, CacheFactory, GlobalOptions, DirectoryService, CachedFileSystem, BuiltinResolver } from '@fimbul/wotan';
import * as TSLint from 'tslint';
export declare class TslintConfigurationProvider implements ConfigurationProvider {
    constructor(resolver: Resolver, fs: CachedFileSystem, cacheFactory: CacheFactory, builtinResolver: BuiltinResolver, directories: DirectoryService, options: GlobalOptions);
    find(fileName: string): string | undefined;
    resolve(name: string, basedir: string): string;
    load(filename: string): Configuration;
    parse(raw: TSLint.Configuration.IConfigurationFile, filename: string): Configuration;
}
