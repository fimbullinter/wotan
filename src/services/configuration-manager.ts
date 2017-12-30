import { injectable, inject, optional } from 'inversify';
import { CachedFileSystem } from './cached-file-system';
import { Resolver, CurrentDirectory, HomeDirectory, Configuration, RawConfiguration, CacheManager, CacheIdentifier } from '../types';
import * as path from 'path';
import { CONFIG_FILENAMES, CONFIG_EXTENSIONS } from '../configuration';
import * as json5 from 'json5';
import { ConfigurationError } from '../error';
import * as yaml from 'js-yaml';
import { OFFSET_TO_NODE_MODULES, arrayify } from '../utils';

// TODO refactor to use a ConfigurationReader/Finder instead of direct IO

const cascadingConfigCache = new CacheIdentifier<string, Configuration>('cascading configuration');
const rootConfigCache = new CacheIdentifier<string, Configuration>('root configuration');

@injectable()
export class ConfigurationManager {
    constructor(
        private fs: CachedFileSystem,
        private resolver: Resolver,
        private cache: CacheManager,
        @inject(CurrentDirectory) private cwd: string,
        @inject(HomeDirectory) @optional() private homeDir?: string,
    ) {
        if (!path.isAbsolute(cwd))
            throw new ConfigurationError('CurrentDirectory must be an absolute path.');
        if (homeDir !== undefined && !path.isAbsolute(homeDir))
            throw new ConfigurationError(`HomeDirectory must be an absolute path.`);
    }

    public findConfigurationPath(file: string): string | undefined {
        let result = this.findupConfig(path.resolve(this.cwd, file));
        if (result === undefined)
            result = this.findConfigurationInHomeDirectory();
        return result;
    }

    public findConfiguration(file: string): Configuration | undefined {
        let config = this.findupConfig(path.resolve(this.cwd, file));
        let cascade = true;
        if (config === undefined) {
            cascade = false;
            config = this.findConfigurationInHomeDirectory();
        }
        return config === undefined ? undefined : this.loadConfigurationFromPath(config, cascade);
    }

    public readConfigFile(filename: string): RawConfiguration {
        switch (path.extname(filename)) {
            case '.json':
            case '.json5': {
                const content = this.fs.readFile(filename);
                if (content === undefined)
                    throw new ConfigurationError(`Error parsing '${filename}': file not found.`);
                try {
                    return json5.parse(content.toString('utf8'));
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
                    return yaml.safeLoad(content.toString('utf8'), {
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
        try {
            return this.resolver.resolve(name, basedir, CONFIG_EXTENSIONS, module.paths.slice(OFFSET_TO_NODE_MODULES + 1));
        } catch (e) {
            throw new ConfigurationError(e.message);
        }
    }

    public loadConfigurationFromPath(file: string, cascade?: boolean): Configuration {
        return this.loadConfigurationFromPathWorker(path.resolve(this.cwd, file), [file], cascade);
    }

    private loadConfigurationFromPathWorker(file: string, stack: string[], cascade?: boolean): Configuration {
        return this.cache.resolve(cascade ? cascadingConfigCache : rootConfigCache, file, () => {
            return this.parseConfigWorker(this.readConfigFile(file), file, stack, cascade);
        });
    }

    public parseConfigFile(raw: RawConfiguration, filename: string, cascade?: boolean): Configuration {
        return this.parseConfigWorker(raw, filename, [filename], cascade);
    }

    private parseConfigWorker(raw: RawConfiguration, filename: string, stack: string[], cascade?: boolean): Configuration {
        const dirname = path.dirname(filename);
        let base = arrayify(raw.extends).map((name) => {
            name = this.resolveConfigFile(name, dirname);
            if (stack.includes(name))
                throw new ConfigurationError(`Circular configuration dependency ${stack.join(' => ')} => ${name}`);
            return this.loadConfigurationFromPathWorker(name, [...stack, name]);
        });
        if (cascade && !raw.root) {
            const next = this.findupConfig(dirname);
            if (next !== undefined)
                base = [this.loadConfigurationFromPathWorker(next, [next], true), ...base];
        }
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
        if (this.homeDir === undefined)
            return;
        const result = this.findConfigFileInDirectory(this.homeDir);
        return result === undefined ? undefined : path.join(this.homeDir, result);
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
