import { injectable } from 'inversify';
import { CachedFileSystem } from './cached-file-system';
import {
    Resolver,
    Configuration,
    RawConfiguration,
    CacheManager,
    CacheIdentifier,
    Cache,
    EffectiveConfiguration,
    GlobalSettings,
    DirectoryService,
} from '../types';
import * as path from 'path';
import * as json5 from 'json5';
import { ConfigurationError } from '../error';
import * as yaml from 'js-yaml';
import { OFFSET_TO_NODE_MODULES, arrayify, resolveCachedResult } from '../utils';
import { reduceConfigurationForFile, getProcessorForFile, getSettingsForFile } from '../configuration';

export const CONFIG_EXTENSIONS = ['yaml', 'yml', 'json5', 'json', 'js'];
export const CONFIG_FILENAMES = CONFIG_EXTENSIONS.map((ext) => '.wotanrc.' + ext);

// TODO refactor to use a ConfigurationReader/Finder instead of direct IO

const configCache = new CacheIdentifier<string, Configuration>('configuration');

@injectable()
export class ConfigurationManager {
    private configCache: Cache<string, Configuration>;
    constructor(
        private fs: CachedFileSystem,
        private resolver: Resolver,
        private directories: DirectoryService,
        cache: CacheManager,
    ) {
        this.configCache = cache.create(configCache);
    }

    public findConfigurationPath(file: string): string | undefined {
        let result = this.findupConfig(path.resolve(this.directories.getCurrentDirectory(), file));
        if (result === undefined)
            result = this.findConfigurationInHomeDirectory();
        return result;
    }

    public findConfiguration(file: string): Configuration | undefined {
        const config = this.findConfigurationPath(file);
        return config === undefined ? undefined : this.loadConfigurationFromPath(config);
    }

    public readConfigurationFile(filename: string): RawConfiguration {
        filename = path.resolve(this.directories.getCurrentDirectory(), filename);
        switch (path.extname(filename)) {
            case '.json':
            case '.json5': {
                const content = this.fs.readFile(filename);
                if (content === undefined)
                    throw new ConfigurationError(`Error parsing '${filename}': file not found.`);
                try {
                    return json5.parse(content);
                } catch (e) {
                    throw new ConfigurationError(`Error parsing '${filename}': ${e.message}`);
                }
            }
            case '.yaml':
            case '.yml': {
                const content = this.fs.readFile(filename);
                if (content === undefined)
                    throw new ConfigurationError(`Error parsing '${filename}': file not found.`);
                try {
                    return yaml.safeLoad(content, {
                        schema: yaml.JSON_SCHEMA,
                        strict: true,
                    });
                } catch (e) {
                    throw new ConfigurationError(`Error parsing '${filename}': ${e.message}`);
                }
            }
            default:
                return this.resolver.require(filename, {cache: false});
        }
    }

    public resolveConfigFile(name: string, basedir: string): string {
        if (name.startsWith('wotan:')) {
            const fileName = path.join(__dirname, `../configs/${name.substr('wotan:'.length)}.js`);
            if (!this.fs.isFile(fileName))
                throw new ConfigurationError(`'${name}' is not a valid builtin configuration, try 'wotan:recommended'.`);
            return fileName;
        }
        basedir = path.resolve(this.directories.getCurrentDirectory(), basedir);
        try {
            return this.resolver.resolve(name, basedir, CONFIG_EXTENSIONS, module.paths.slice(OFFSET_TO_NODE_MODULES + 1));
        } catch (e) {
            throw new ConfigurationError(e.message);
        }
    }

    public reduceConfigurationForFile(config: Configuration, file: string): EffectiveConfiguration | undefined {
        return reduceConfigurationForFile(config, file, this.directories.getCurrentDirectory());
    }

    public getProcessorForFile(config: Configuration, file: string): string | undefined {
        return getProcessorForFile(config, file, this.directories.getCurrentDirectory());
    }

    public getSettingsForFile(config: Configuration, file: string): GlobalSettings {
        return getSettingsForFile(config, file, this.directories.getCurrentDirectory());
    }

    public loadConfigurationFromPath(file: string): Configuration {
        return this.loadConfigurationFromPathWorker(path.resolve(this.directories.getCurrentDirectory(), file), [file]);
    }

    private loadConfigurationFromPathWorker(file: string, stack: string[]): Configuration {
        return resolveCachedResult(this.configCache, file, () => {
            return this.parseConfigWorker(this.readConfigurationFile(file), file, stack);
        });
    }

    public parseConfiguration(raw: RawConfiguration, filename: string): Configuration {
        filename = path.resolve(this.directories.getCurrentDirectory(), filename);
        return this.parseConfigWorker(raw, filename, [filename]);
    }

    private parseConfigWorker(raw: RawConfiguration, filename: string, stack: string[]): Configuration {
        const dirname = path.dirname(filename);
        const base = arrayify(raw.extends).map((name) => {
            name = this.resolveConfigFile(name, dirname);
            if (stack.includes(name))
                throw new ConfigurationError(`Circular configuration dependency ${stack.join(' => ')} => ${name}`);
            return this.loadConfigurationFromPathWorker(name, [...stack, name]);
        });
        return {
            filename,
            extends: base,
            aliases: raw.aliases && this.mapAliases(raw.aliases),
            overrides: raw.overrides && raw.overrides.map((o) => this.mapOverride(o, dirname)),
            rules: raw.rules && this.mapRules(raw.rules),
            rulesDirectories: raw.rulesDirectories && this.mapRulesDirectory(raw.rulesDirectories, dirname),
            processor: this.mapProcessor(raw.processor, dirname),
            exclude: Array.isArray(raw.exclude) ? raw.exclude : raw.exclude === undefined ? undefined : [raw.exclude],
            settings: raw.settings,
        };
    }

    private mapAliases(aliases: {[prefix: string]: {[name: string]: RawConfiguration.Alias | null }}) {
        const result: Configuration['aliases'] = {};
        for (const prefix of Object.keys(aliases)) {
            const obj = aliases[prefix];
            if (!obj)
                continue;
            for (const name of Object.keys(obj)) {
                const config = obj[name];
                const fullName = `${prefix}/${name}`;
                if (config && !config.rule)
                    throw new ConfigurationError(`Alias '${fullName}' does not specify a rule.`);
                result[fullName] = config;
            }
        }
        return result;
    }

    private mapOverride(raw: RawConfiguration.Override, basedir: string): Configuration.Override {
        const files = arrayify(raw.files);
        if (files.length === 0)
            throw new ConfigurationError(`Override does not specify files.`);
        return {
            files: arrayify(raw.files),
            rules: raw.rules && this.mapRules(raw.rules),
            settings: raw.settings,
            processor: this.mapProcessor(raw.processor, basedir),
        };
    }

    private mapProcessor(processor: string | undefined, basedir: string): string | undefined {
        return processor && this.resolver.resolve(
            processor,
            basedir,
            Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
            module.paths.slice(OFFSET_TO_NODE_MODULES + 1),
        );
    }

    private mapRulesDirectory(raw: {[prefix: string]: string}, dirname: string) {
        const result = new Map<string, string>();
        for (const key of Object.keys(raw))
            result.set(key, path.resolve(dirname, raw[key]));
        return result;
    }

    private mapRules(raw: {[name: string]: RawConfiguration.RuleConfigValue}) {
        const result: {[name: string]: Configuration.RuleConfig} = {};
        for (const key of Object.keys(raw))
            result[key] = this.mapRuleConfig(raw[key]);
        return result;
    }

    private mapRuleConfig(value: RawConfiguration.RuleConfigValue): Configuration.RuleConfig {
        if (typeof value === 'string')
            return { severity: this.mapRuleSeverity(value) };
        if (!value)
            return {};
        const result: Configuration.RuleConfig = {};
        if ('options' in value)
            result.options = value.options;
        if ('severity' in value)
            result.severity = this.mapRuleSeverity(value.severity!);
        return result;
    }

    private mapRuleSeverity(severity: RawConfiguration.RuleSeverity): Configuration.RuleSeverity {
        switch (severity) {
            case 'off':
                return 'off';
            case 'warn':
            case 'warning':
                return 'warning';
            default:
                return 'error';
        }
    }

    private findConfigurationInHomeDirectory(): string | undefined {
        if (this.directories.getHomeDirectory === undefined)
            return;
        const homeDir = this.directories.getHomeDirectory();
        const result = this.findConfigFileInDirectory(homeDir);
        return result === undefined ? undefined : path.join(homeDir, result);
    }

    private findupConfig(current: string): string | undefined {
        let next = path.dirname(current);
        while (next !== current) {
            current = next;
            const config = this.findConfigFileInDirectory(current);
            if (config !== undefined)
                return path.join(current, config);
            next = path.dirname(next);
        }
        return;
    }

    private findConfigFileInDirectory(dir: string): string | undefined {
        const entries = this.fs.readDirectory(dir);
        for (const name of CONFIG_FILENAMES)
            if (entries.includes(name))
                return name;
        return;
    }
}
