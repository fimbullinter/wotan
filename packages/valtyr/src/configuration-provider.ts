import { injectable } from 'inversify';
import {
    ConfigurationProvider,
    Resolver,
    Configuration,
    CacheFactory,
    Cache,
    DefaultConfigurationProvider,
    GlobalOptions,
    DirectoryService,
    CachedFileSystem,
    ConfigurationError,
    BuiltinResolver,
} from '@fimbul/wotan';
import * as TSLint from 'tslint';
import * as path from 'path';

/**
 * Number of .. until the containing node_modules.
 * __dirname -> src
 * ..        -> project root
 * ../..     -> node_modules (or @scope)
 * ../../..  -> node_modules if @scoped package
 */
const OFFSET_TO_NODE_MODULES = 3;

@injectable()
export class TslintConfigurationProvider implements ConfigurationProvider {
    private cache: Cache<string, string | undefined>;
    private tslintConfigDir: string | undefined = undefined;
    private baseConfig: Configuration[] | undefined = undefined;
    constructor(
        private resolver: Resolver,
        private fs: CachedFileSystem,
        private cacheFactory: CacheFactory,
        private builtinResolver: BuiltinResolver,
        private directories: DirectoryService,
        private options: GlobalOptions,
    ) {
        this.cache = cacheFactory.create();
    }

    public find(fileName: string) {
        fileName = path.dirname(fileName);
        let result = this.cache.get(fileName);
        if (result === undefined && !this.cache.has(fileName)) {
            result = TSLint.Configuration.findConfigurationPath(null, fileName);
            const {root} = path.parse(fileName);
            // prevent infinite loop when result is on different drive
            const configDirname = result === undefined || root !== path.parse(result).root ? root : path.dirname(result);
            this.cache.set(fileName, result);
            while (fileName !== configDirname) {
                this.cache.set(fileName, result);
                fileName = path.dirname(fileName);
            }
        }
        return result;
    }

    public resolve(name: string, basedir: string) {
        const extensions = [...this.resolver.getDefaultExtensions(), '.json'];
        if (name.startsWith('tslint:')) {
            try {
                this.tslintConfigDir ??= path.join(
                    this.resolver.resolve('tslint', path.dirname(__dirname), extensions),
                    '../configs',
                );
                return this.resolver.resolve(path.join(this.tslintConfigDir, name.substr('tslint:'.length)), '', extensions);
            } catch {
                throw new Error(`'${name}' is not a valid builtin configuration, try 'tslint:recommended.'`);
            }
        }
        return this.resolver.resolve(
            name,
            basedir,
            extensions,
            module.paths.slice(OFFSET_TO_NODE_MODULES),
        );
    }

    public load(filename: string): Configuration {
        return this.parse(TSLint.Configuration.loadConfigurationFromPath(filename), filename);
    }

    public parse(raw: TSLint.Configuration.IConfigurationFile, filename: string): Configuration {
        const rulesDirectories = raw.rulesDirectory.length === 0 ? undefined : raw.rulesDirectory;
        const overrides: Configuration.Override[] = [];
        if (raw.rules.size !== 0)
            overrides.push({
                files: ['*', '!*.js?(x)'],
                rules: new Map(Array.from(raw.rules, mapRules)),
            });
        if (raw.jsRules.size !== 0)
            overrides.push({
                files: ['*.js?(x)'],
                rules: new Map(Array.from(raw.jsRules, mapRules)),
            });
        return {
            overrides,
            filename,
            extends: this.getBaseConfiguration(),
            exclude: raw.linterOptions && raw.linterOptions.exclude && mapExcludes(raw.linterOptions.exclude, path.dirname(filename)),
        };

        function mapRules([rule, config]: [string, Partial<TSLint.IOptions>]): [string, Configuration.RuleConfig] {
            return [
                rule,
                {
                    rule,
                    rulesDirectories,
                    severity: config.ruleSeverity,
                    options: config.ruleArguments,
                },
            ];
        }
    }

    private getBaseConfiguration() {
        if (this.baseConfig !== undefined)
            return this.baseConfig;
        if (!this.options.valtyr)
            return this.baseConfig = [];
        try {
            const fullPath = path.join(this.directories.getCurrentDirectory(), '.fimbullinter.yaml');
            const configProvider = new DefaultConfigurationProvider(this.fs, this.resolver, this.builtinResolver, this.cacheFactory);
            const config = configProvider.parse(this.options.valtyr, fullPath, {
                stack: [],
                load() {
                    throw new Error('Global configuration is not allowed to extend other configs.');
                },
            });
            validateGlobalConfig(config);
            return this.baseConfig = [config];
        } catch (e) {
            throw new ConfigurationError(`Error parsing global configuration for 'valtyr': ${e.message}`);
        }
    }
}

function mapExcludes(excludes: Iterable<string>, configDir: string) {
    const result = [];
    for (const e of excludes)
        result.push(path.relative(configDir, e));
    return result;
}

function validateGlobalConfig(config: Configuration) {
    checkNonExistence(config, 'exclude');
    checkNonExistence(config, 'rules');
    checkNonExistence(config, 'rulesDirectories');
    checkNonExistence(config, 'aliases');
    if (config.overrides !== undefined)
        for (const override of config.overrides)
            checkNonExistence(override, 'rules');
}

function checkNonExistence<K extends keyof Configuration | keyof Configuration.Override>(config: Partial<Record<K, unknown>>, key: K) {
    if (config[key] !== undefined)
        throw new Error(`'${key}' is not allowed in global configuration.`);
}
