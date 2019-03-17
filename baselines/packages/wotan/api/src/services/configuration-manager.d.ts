import { Configuration, CacheFactory, ReducedConfiguration, Settings, DirectoryService, ConfigurationProvider } from '@fimbul/ymir';
import { CachedFileSystem } from './cached-file-system';
export declare class ConfigurationManager {
    constructor(directories: DirectoryService, configProvider: ConfigurationProvider, fs: CachedFileSystem, cache: CacheFactory);
    findPath(file: string): string | undefined;
    find(file: string): Configuration | undefined;
    loadLocalOrResolved(pathOrName: string, basedir?: string): Configuration;
    resolve(name: string, basedir: string): string;
    reduce(config: Configuration, file: string): ReducedConfiguration | undefined;
    getProcessor(config: Configuration, fileName: string): string | undefined;
    getSettings(config: Configuration, fileName: string): Settings;
    load(fileName: string): Configuration;
}
