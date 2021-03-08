import { Configuration, CacheFactory, ReducedConfiguration, Settings, DirectoryService, ConfigurationProvider } from '@fimbul/ymir';
import { CachedFileSystem } from './cached-file-system';
export declare class ConfigurationManager {
    constructor(directories: DirectoryService, configProvider: ConfigurationProvider, fs: CachedFileSystem, cache: CacheFactory);
    /** Look up the location of the configuration file for the specified file name. */
    findPath(file: string): string | undefined;
    /** Load the configuration for the specified file. */
    find(file: string): Configuration | undefined;
    /** Load the given config from a local file if it exists or from the resolved path otherwise */
    loadLocalOrResolved(pathOrName: string, basedir?: string): Configuration;
    /**
     * Resolve a configuration name to it's absolute path.
     *
     * @param name
     *   - name of a builtin config
     *   - package name in `node_modules` or a submodule thereof
     *   - absolute path
     *   - relative path starting with `./` or `../`
     */
    resolve(name: string, basedir: string): string;
    /**
     * Collects all matching configuration options for the given file. Flattens all base configs and matches overrides.
     * Returns `undefined` if the file is excluded in one of the configuraton files.
     */
    reduce(config: Configuration, file: string): ReducedConfiguration | undefined;
    /** Get the processor configuration for a given file. */
    getProcessor(config: Configuration, fileName: string): string | undefined;
    /** Get the settings for a given file. */
    getSettings(config: Configuration, fileName: string): Settings;
    /** Load a configuration from a resolved path using the ConfigurationProvider, recursively resolving and loading base configs. */
    load(fileName: string): Configuration;
}
