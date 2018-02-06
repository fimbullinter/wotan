import { injectable } from 'inversify';
import { ConfigurationProvider, DirectoryService, Resolver, ParseConfigurationContext, Configuration } from '../../types';
import { CachedFileSystem } from '../cached-file-system';
import * as path from 'path';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';
import { OFFSET_TO_NODE_MODULES, arrayify } from '../../utils';

export interface RawConfiguration {
    aliases?: {[prefix: string]: {[name: string]: RawConfiguration.Alias | null | false}};
    rules?: {[key: string]: RawConfiguration.RuleConfigValue};
    settings?: {[key: string]: any};
    extends?: string | string[];
    overrides?: RawConfiguration.Override[];
    rulesDirectories?: {[prefix: string]: string};
    exclude?: string | string[];
    processor?: string | null | false;
}

export namespace RawConfiguration {
    export type RuleSeverity = 'off' | 'warn' | 'warning' | 'error';
    export interface RuleConfig {
        severity?: RuleSeverity;
        options?: any;
    }
    export type RuleConfigValue = RuleSeverity | RuleConfig | null;
    export interface Override {
        files: string | string[];
        rules?: {[key: string]: RawConfiguration.RuleConfigValue};
        settings?: {[key: string]: any};
        processor?: string | null | false;
    }
    export interface Alias {
        rule: string;
        options?: any;
    }
}

export const CONFIG_EXTENSIONS = ['.yaml', '.yml', '.json5', '.json', '.js'];
export const CONFIG_FILENAMES = CONFIG_EXTENSIONS.map((ext) => '.wotanrc' + ext);

@injectable()
export class DefaultConfigurationProvider implements ConfigurationProvider<RawConfiguration> {
    constructor(private fs: CachedFileSystem, private directories: DirectoryService, private resolver: Resolver) {}

    public find(fileToLint: string): string | undefined {
        let result = this.findupConfig(fileToLint);
        if (result === undefined && this.directories.getHomeDirectory !== undefined)
            result = this.findConfigFileInDirectory(this.directories.getHomeDirectory());
        return result;
    }

    public read(filename: string): RawConfiguration {
        switch (path.extname(filename)) {
            case '.json':
            case '.json5':
                return json5.parse(this.fs.readFile(filename));
            case '.yaml':
            case '.yml':
                return yaml.safeLoad(this.fs.readFile(filename), {
                    schema: yaml.JSON_SCHEMA,
                    strict: true,
                });
            default:
                return this.resolver.require(filename, {cache: false});
        }
    }

    public resolve(name: string, basedir: string): string {
        if (name.startsWith('wotan:')) {
            const fileName = path.join(__dirname, `../../configs/${name.substr('wotan:'.length)}.yaml`);
            if (!this.fs.isFile(fileName))
                throw new Error(`'${name}' is not a valid builtin configuration, try 'wotan:recommended'.`);
            return fileName;
        }
        return this.resolver.resolve(name, basedir, CONFIG_EXTENSIONS, module.paths.slice(OFFSET_TO_NODE_MODULES + 2));
    }

    public parse(raw: RawConfiguration, filename: string, context: ParseConfigurationContext): Configuration {
        const dirname = path.dirname(filename);
        return {
            filename,
            extends: arrayify(raw.extends).map(context.load),
            aliases: raw.aliases && mapAliases(raw.aliases),
            overrides: raw.overrides && raw.overrides.map((o) => this.mapOverride(o, dirname)),
            rules: raw.rules && mapRules(raw.rules),
            rulesDirectories: raw.rulesDirectories && this.mapRulesDirectory(raw.rulesDirectories, dirname),
            processor: this.mapProcessor(raw.processor, dirname),
            exclude: Array.isArray(raw.exclude) ? raw.exclude : raw.exclude === undefined ? undefined : [raw.exclude],
            settings: raw.settings && mapSettings(raw.settings),
        };
    }

    private mapOverride(raw: RawConfiguration.Override, basedir: string): Configuration.Override {
        const files = arrayify(raw.files);
        if (files.length === 0)
            throw new Error(`Override does not specify files.`);
        return {
            files: arrayify(raw.files),
            rules: raw.rules && mapRules(raw.rules),
            settings: raw.settings && mapSettings(raw.settings),
            processor: this.mapProcessor(raw.processor, basedir),
        };
    }

    private mapProcessor(processor: RawConfiguration['processor'], basedir: string): Configuration['processor'] {
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

    private findupConfig(current: string): string | undefined {
        let next = path.dirname(current);
        while (next !== current) {
            current = next;
            const config = this.findConfigFileInDirectory(current);
            if (config !== undefined)
                return config;
            next = path.dirname(next);
        }
        return;
    }

    private findConfigFileInDirectory(dir: string): string | undefined {
        for (let name of CONFIG_FILENAMES) {
            name = path.join(dir, name);
            if (this.fs.isFile(name))
                return name;
        }
        return;
    }
}

function mapAliases(aliases: {[prefix: string]: {[name: string]: RawConfiguration.Alias | null | false }}) {
    const result: Configuration['aliases'] = new Map();
    for (const prefix of Object.keys(aliases)) {
        const obj = aliases[prefix];
        if (!obj)
            continue;
        for (const name of Object.keys(obj)) {
            const config = obj[name];
            const fullName = `${prefix}/${name}`;
            if (config && !config.rule)
                throw new Error(`Alias '${fullName}' does not specify a rule.`);
            result.set(fullName, config);
        }
    }
    return result;
}

function mapRules(raw: {[name: string]: RawConfiguration.RuleConfigValue}) {
    const result: Configuration['rules'] = new Map();
    for (const key of Object.keys(raw))
        result.set(key, mapRuleConfig(raw[key]));
    return result;
}

function mapRuleConfig(value: RawConfiguration.RuleConfigValue): Configuration.RuleConfig {
    if (typeof value === 'string')
        return { severity: mapRuleSeverity(value) };
    if (!value)
        return {};
    const result: Configuration.RuleConfig = {};
    if ('options' in value)
        result.options = value.options;
    if ('severity' in value)
        result.severity = mapRuleSeverity(value.severity!);
    return result;
}

function mapRuleSeverity(severity: RawConfiguration.RuleSeverity): Configuration.RuleSeverity {
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

function mapSettings(settings: {[key: string]: any}) {
    const result: Configuration['settings'] = new Map();
    for (const key of Object.keys(settings))
        result.set(key, settings[key]);
    return result;
}
