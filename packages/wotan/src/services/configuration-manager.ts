import { injectable } from 'inversify';
import {
    Configuration,
    CacheFactory,
    Cache,
    ReducedConfiguration,
    Settings,
    DirectoryService,
    ConfigurationProvider,
    EffectiveConfiguration,
    ConfigurationError,
} from '@fimbul/ymir';
import * as path from 'path';
import { resolveCachedResult } from '../utils';
import { Minimatch } from 'minimatch';
import * as isNegated from 'is-negated-glob';
import { CachedFileSystem } from './cached-file-system';

@injectable()
export class ConfigurationManager {
    private configCache: Cache<string, Configuration>;
    constructor(
        private directories: DirectoryService,
        private configProvider: ConfigurationProvider,
        private fs: CachedFileSystem,
        cache: CacheFactory,
    ) {
        this.configCache = cache.create();
    }

    /** Look up the location of the configuration file for the specified file name. */
    public findPath(file: string): string | undefined {
        file = path.resolve(this.directories.getCurrentDirectory(), file);
        try {
            return this.configProvider.find(file);
        } catch (e) {
            throw new ConfigurationError(`Error finding configuration for '${file}': ${e && e.message}`);
        }
    }

    /** Load the configuration for the specified file. */
    public find(file: string): Configuration | undefined {
        const config = this.findPath(file);
        return config === undefined ? undefined : this.load(config);
    }

    /** Load the given config from a local file if it exists or from the resolved path otherwise */
    public loadLocalOrResolved(pathOrName: string, basedir = this.directories.getCurrentDirectory()): Configuration {
        const absolute = path.resolve(basedir, pathOrName);
        return this.load(this.fs.isFile(absolute) ? absolute : this.resolve(pathOrName, basedir));
    }

    /**
     * Resolve a configuration name to it's absolute path.
     *
     * @param name
     *   - name of a builtin config
     *   - package name in `node_modules` or a submodule thereof
     *   - absolute path
     *   - relative path starting with `./` or `../`
     */
    public resolve(name: string, basedir: string): string {
        try {
            return this.configProvider.resolve(name, path.resolve(this.directories.getCurrentDirectory(), basedir));
        } catch (e) {
            throw new ConfigurationError(`${e && e.message}`);
        }
    }

    /**
     * Collects all matching configuration options for the given file. Flattens all base configs and matches overrides.
     * Returns `undefined` if the file is excluded in one of the configuraton files.
     */
    public reduce(config: Configuration, file: string): ReducedConfiguration | undefined {
        return reduceConfig(
            config,
            path.resolve(this.directories.getCurrentDirectory(), file),
            {rules: new Map(), settings: new Map(), processor: undefined},
        );
    }

    /** Get the processor configuration for a given file. */
    public getProcessor(config: Configuration, fileName: string): string | undefined {
        return findProcessorInConfig(config, path.resolve(this.directories.getCurrentDirectory(), fileName)) || undefined;
    }

    /** Get the settings for a given file. */
    public getSettings(config: Configuration, fileName: string): Settings {
        return reduceSettings(config, path.resolve(this.directories.getCurrentDirectory(), fileName), new Map());
    }

    /** Load a configuration from a resolved path using the ConfigurationProvider, recursively resolving and loading base configs. */
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

function reduceConfig(config: Configuration, filename: string, receiver: ReducedConfiguration): ReducedConfiguration | undefined {
    const relativeFilename = path.relative(path.dirname(config.filename), filename);
    if (config.exclude !== undefined && matchesGlobs(relativeFilename, config.exclude))
        return;
    for (const base of config.extends)
        if (reduceConfig(base, filename, receiver) === undefined)
            return;

    extendConfig(receiver, config);

    if (config.overrides !== undefined)
        for (const override of config.overrides)
            if (matchesGlobs(relativeFilename, override.files))
                extendConfig(receiver, override);

    return receiver;
}

function extendConfig(receiver: ReducedConfiguration, config: Configuration | Configuration.Override) {
    if (config.processor !== undefined)
        receiver.processor = config.processor || undefined;
    if (config.settings !== undefined)
        extendSettings(receiver.settings, config.settings);
    if (config.rules !== undefined)
        extendRules(receiver.rules, config.rules);
}

function matchesGlobs(file: string, patterns: ReadonlyArray<string>): boolean {
    for (let i = patterns.length - 1; i >= 0; --i) {
        const glob = isNegated(patterns[i]);
        const local = glob.pattern.startsWith('./');
        if (local)
            glob.pattern = glob.pattern.substr(2);
        if (new Minimatch(glob.pattern, {matchBase: !local, dot: true}).match(file))
            return !glob.negated;
    }
    return false;
}

function extendRules(
    receiver: EffectiveConfiguration['rules'],
    rules: ReadonlyMap<string, Configuration.RuleConfig>,
) {
    for (const [ruleName, config] of rules) {
        const prev = receiver.get(ruleName);
        receiver.set(ruleName, {
            severity: 'error',
            options: undefined,
            ...prev,
            ...config,
        });
    }
}

function extendSettings(receiver: EffectiveConfiguration['settings'], settings: ReadonlyMap<string, any>) {
    for (const [key, value] of settings)
        receiver.set(key, value);
}

function findProcessorInConfig(config: Configuration, fileName: string): string | undefined | null | false {
    if (config.overrides !== undefined) {
        const relative = path.relative(path.dirname(config.filename), fileName);
        for (let i = config.overrides.length - 1; i >= 0; --i) {
            const override = config.overrides[i];
            if (override.processor !== undefined && matchesGlobs(relative, override.files))
                return override.processor;
        }
    }
    if (config.processor !== undefined)
        return config.processor;
    for (let i = config.extends.length - 1; i >= 0; --i) {
        const processor = findProcessorInConfig(config.extends[i], fileName);
        if (processor !== undefined)
            return processor;
    }
    return;
}

function reduceSettings(config: Configuration, fileName: string, receiver: Map<string, any>) {
    for (const base of config.extends)
        reduceSettings(base, fileName, receiver);
    if (config.settings !== undefined)
        extendSettings(receiver, config.settings);
    if (config.overrides !== undefined) {
        const relative = path.relative(path.dirname(config.filename), fileName);
        for (const override of config.overrides)
            if (override.settings && matchesGlobs(relative, override.files))
                extendSettings(receiver, override.settings);
    }
    return receiver;
}
