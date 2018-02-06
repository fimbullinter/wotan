import { injectable } from 'inversify';
import {
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
import { ConfigurationError } from '../error';
import { resolveCachedResult } from '../utils';
import { reduceConfigurationForFile, getProcessorForFile, getSettingsForFile } from '../configuration';

export const CONFIG_EXTENSIONS = ['.yaml', '.yml', '.json5', '.json', '.js'];
export const CONFIG_FILENAMES = CONFIG_EXTENSIONS.map((ext) => '.wotanrc' + ext);

// TODO refactor to use a ConfigurationReader/Finder instead of direct IO

const configCache = new CacheIdentifier<string, Configuration>('configuration');

@injectable()
export class ConfigurationManager {
    private configCache: Cache<string, Configuration>;
    constructor(
        private directories: DirectoryService,
        private configProvider: ConfigurationProvider,
        cache: CacheManager,
    ) {
        this.configCache = cache.create(configCache);
    }

    public findPath(file: string): string | undefined {
        file = path.resolve(this.directories.getCurrentDirectory(), file);
        try {
            return this.configProvider.find(file);
        } catch (e) {
            throw new ConfigurationError(`Error finding configuration for '${file}': ${e && e.message}`);
        }
    }

    public find(file: string): Configuration | undefined {
        const config = this.findPath(file);
        return config === undefined ? undefined : this.load(config);
    }

    public resolve(name: string, basedir: string): string {
        try {
            return this.configProvider.resolve(name, path.resolve(this.directories.getCurrentDirectory(), basedir));
        } catch (e) {
            throw new ConfigurationError(e && e.message);
        }
    }

    public reduce(config: Configuration, file: string): ReducedConfiguration | undefined {
        return reduceConfigurationForFile(config, file, this.directories.getCurrentDirectory());
    }

    public getProcessor(config: Configuration, fileName: string): string | undefined {
        return getProcessorForFile(config, fileName, this.directories.getCurrentDirectory());
    }

    public getSettings(config: Configuration, fileName: string): GlobalSettings {
        return getSettingsForFile(config, fileName, this.directories.getCurrentDirectory());
    }

    public load(fileName: string): Configuration {
        const stack: string[] = [];
        const loadResolved = (file: string): Configuration => {
            const circular = stack.includes(file);
            stack.push(file);
            if (circular)
                throw new Error(`Circular configuration dependency.`);
            const config = this.configProvider.load(file, {
                stack,
                load: (name) => resolveCachedResult(this.configCache, this.configProvider.resolve(name, path.dirname(file)), loadResolved),
            });
            stack.pop();
            return config;
        };
        try {
            return resolveCachedResult(this.configCache, path.resolve(this.directories.getCurrentDirectory(), fileName), loadResolved);
        } catch (e) {
            throw new ConfigurationError(`Error loading ${stack.join(' => ')}: ${e && e.message}`);
        }
    }
}
