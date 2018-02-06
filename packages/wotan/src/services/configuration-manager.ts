import { injectable } from 'inversify';
import { CachedFileSystem } from './cached-file-system';
import {
    Resolver,
    Configuration,
    CacheManager,
    CacheIdentifier,
    Cache,
    ReducedConfiguration,
    GlobalSettings,
    DirectoryService,
    ConfigurationProvider,
} from '../types';
import * as path from 'path';
import * as json5 from 'json5';
import { ConfigurationError } from '../error';
import * as yaml from 'js-yaml';
import { OFFSET_TO_NODE_MODULES, arrayify, resolveCachedResult } from '../utils';
import { reduceConfigurationForFile, getProcessorForFile, getSettingsForFile } from '../configuration';

export const CONFIG_EXTENSIONS = ['.yaml', '.yml', '.json5', '.json', '.js'];
export const CONFIG_FILENAMES = CONFIG_EXTENSIONS.map((ext) => '.wotanrc' + ext);

// TODO refactor to use a ConfigurationReader/Finder instead of direct IO

const configCache = new CacheIdentifier<string, Configuration>('configuration');

@injectable()
export class ConfigurationManager {
    private configCache: Cache<string, Configuration>;
    constructor(
        private fs: CachedFileSystem,
        private resolver: Resolver,
        private directories: DirectoryService,
        private configProvider: ConfigurationProvider<object>,
        cache: CacheManager,
    ) {
        this.configCache = cache.create(configCache);
    }

    public findConfigurationPath(file: string): string | undefined {
        return this.configProvider.find(path.resolve(this.directories.getCurrentDirectory(), file));
    }

    public findConfiguration(file: string): Configuration | undefined {
        const config = this.findConfigurationPath(file);
        return config === undefined ? undefined : this.loadConfigurationFromPath(config);
    }

    public resolveConfigFile(name: string, basedir: string): string {
        // ConfigurationError
        return this.configProvider.resolve(name, path.resolve(this.directories.getCurrentDirectory(), basedir));
    }

    public reduceConfigurationForFile(config: Configuration, file: string): ReducedConfiguration | undefined {
        return reduceConfigurationForFile(config, file, this.directories.getCurrentDirectory());
    }

    public getProcessorForFile(config: Configuration, file: string): string | undefined {
        return getProcessorForFile(config, file, this.directories.getCurrentDirectory());
    }

    public getSettingsForFile(config: Configuration, file: string): GlobalSettings {
        return getSettingsForFile(config, file, this.directories.getCurrentDirectory());
    }

    public loadConfigurationFromPath(file: string): Configuration {
        return this.loadConfigurationFromPathWorker(path.resolve(this.directories.getCurrentDirectory(), file), []);
    }

    private loadConfigurationFromPathWorker(file: string, stack: ReadonlyArray<string>): Configuration {
        return resolveCachedResult(this.configCache, file, () => {
            if (stack.includes(file))
                throw new ConfigurationError(`Circular configuration dependency ${stack.join(' => ')} => ${file}`);
            // ConfigurationError
            return this.configProvider.parse(this.configProvider.read(file), file, {
                parents: stack,
                load: (name) => this.loadConfigurationFromPathWorker(
                    this.configProvider.resolve(name, path.dirname(file)),
                    [...stack, file],
                ),
            });
        });
    }
}
