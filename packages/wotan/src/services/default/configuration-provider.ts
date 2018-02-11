import { injectable } from 'inversify';
import { ConfigurationProvider, Resolver, LoadConfigurationContext, Configuration } from '../../types';
import { CachedFileSystem } from '../cached-file-system';
import * as path from 'path';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';
import { OFFSET_TO_NODE_MODULES, arrayify } from '../../utils';

export interface RawConfiguration {
    aliases?: RawConfiguration.AliasMap;
    rules?: RawConfiguration.RuleMap;
    settings?: RawConfiguration.SettingsMap;
    extends?: string | string[];
    overrides?: RawConfiguration.Override[];
    rulesDirectories?: RawConfiguration.RulesDirectoryMap;
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
        rules?: RuleMap;
        settings?: SettingsMap;
        processor?: string | null | false;
    }
    export interface Alias {
        rule: string;
        options?: any;
    }
    export interface RuleMap {
        [key: string]: RawConfiguration.RuleConfigValue;
    }
    export interface AliasMap {
        [prefix: string]: {[name: string]: RawConfiguration.Alias | null | false | string} | null | false;
    }
    export interface RulesDirectoryMap {
        [prefix: string]: string;
    }
    export interface SettingsMap {
        [key: string]: any;
    }
}

type WriteableRulesDirectoryMap = Map<string, string[]>;
type WriteableAliasesMap = Map<string, Configuration.Alias>;

export const CONFIG_EXTENSIONS = ['.yaml', '.yml', '.json5', '.json', '.js'];
export const CONFIG_FILENAMES = CONFIG_EXTENSIONS.map((ext) => '.wotanrc' + ext);

@injectable()
export class DefaultConfigurationProvider implements ConfigurationProvider {
    constructor(private fs: CachedFileSystem, private resolver: Resolver) {}

    public find(current: string): string | undefined {
        let next = path.dirname(current);
        while (next !== current) {
            current = next;
            for (let name of CONFIG_FILENAMES) {
                name = path.join(current, name);
                if (this.fs.isFile(name))
                    return name;
            }
            next = path.dirname(next);
        }
        return;
    }

    public resolve(name: string, basedir: string): string {
        if (name.startsWith('wotan:')) {
            const fileName = path.join(__dirname, `../../../configs/${name.substr('wotan:'.length)}.yaml`);
            if (!this.fs.isFile(fileName))
                throw new Error(`'${name}' is not a valid builtin configuration, try 'wotan:recommended'.`);
            return fileName;
        }
        return this.resolver.resolve(name, basedir, CONFIG_EXTENSIONS, module.paths.slice(OFFSET_TO_NODE_MODULES + 2));
    }

    public load(filename: string, context: LoadConfigurationContext): Configuration {
        return this.parse(this.read(filename), filename, context);
    }

    public parse(raw: RawConfiguration, filename: string, context: LoadConfigurationContext): Configuration {
        const dirname = path.dirname(filename);
        const baseConfigs = arrayify(raw.extends).map((base) => context.load(base));
        let rulesDirectories: WriteableRulesDirectoryMap | undefined;
        let aliases: WriteableAliasesMap | undefined;
        for (const base of baseConfigs) {
            if (base.rulesDirectories !== undefined) {
                if (rulesDirectories === undefined) {
                    rulesDirectories = new Map(Array.from(base.rulesDirectories, (v): [string, string[]] => [v[0], v[1].slice()]));
                } else {
                    extendRulesDirectories(rulesDirectories, base.rulesDirectories);
                }
            }
            if (base.aliases !== undefined) {
                if (aliases === undefined) {
                    aliases = new Map(base.aliases);
                } else {
                    for (const [name, alias] of base.aliases)
                        aliases.set(name, alias);
                }
            }
        }
        if (raw.rulesDirectories)
            rulesDirectories = mapRulesDirectories(rulesDirectories, raw.rulesDirectories, dirname);
        if (raw.aliases)
            aliases = resolveAliases(raw.aliases, aliases, rulesDirectories);
        return {
            aliases,
            filename,
            rulesDirectories,
            extends: baseConfigs,
            overrides: raw.overrides && raw.overrides.map((o, i) => this.mapOverride(o, i, dirname, aliases, rulesDirectories)),
            rules: raw.rules ? mapRules(raw.rules, aliases, rulesDirectories) : undefined,
            processor: this.mapProcessor(raw.processor, dirname),
            exclude: Array.isArray(raw.exclude) ? raw.exclude : raw.exclude ? [raw.exclude] : undefined,
            settings: raw.settings ? mapSettings(raw.settings) : undefined,
        };
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

    private mapOverride(
        raw: RawConfiguration.Override,
        index: number,
        basedir: string,
        aliases: Configuration['aliases'],
        rulesDirectoryMap: Configuration['rulesDirectories'],
    ): Configuration.Override {
        const files = arrayify(raw.files);
        if (files.length === 0)
            throw new Error(`Override ${index} does not specify files.`);
        return {
            files,
            rules: raw.rules ? mapRules(raw.rules, aliases, rulesDirectoryMap) : undefined,
            settings: raw.settings ? mapSettings(raw.settings) : undefined,
            processor: this.mapProcessor(raw.processor, basedir),
        };
    }

    private mapProcessor(processor: RawConfiguration['processor'], basedir: string): Configuration['processor'] {
        return processor && this.resolver.resolve(
            processor,
            basedir,
            Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
            module.paths.slice(OFFSET_TO_NODE_MODULES + 2),
        );
    }
}

function mapRulesDirectories(receiver: WriteableRulesDirectoryMap | undefined, raw: RawConfiguration.RulesDirectoryMap, dirname: string) {
    if (receiver === undefined)
        receiver = new Map();
    for (const key of Object.keys(raw)) {
        const resolved = path.resolve(dirname, raw[key]);
        const current = receiver.get(key);
        if (current === undefined) {
            receiver.set(key, [resolved]);
        } else {
            current.unshift(resolved);
        }
    }
    return receiver;
}

function extendRulesDirectories(receiver: WriteableRulesDirectoryMap, current: Configuration.RulesDirectoryMap) {
    for (const [key, directories] of current) {
        const prev = receiver.get(key);
        if (prev !== undefined) {
            prev.unshift(...directories);
        } else {
            receiver.set(key, directories.slice());
        }
    }
}

function resolveAliases(
    raw: RawConfiguration.AliasMap,
    receiver: WriteableAliasesMap | undefined,
    rulesDirectoryMap: Configuration['rulesDirectories'],
) {
    const mapped: Map<string, RawConfiguration.Alias> = new Map();
    for (const prefix of Object.keys(raw)) {
        const obj = raw[prefix];
        if (!obj)
            continue;
        for (const name of Object.keys(obj)) {
            let config = obj[name];
            const fullName = `${prefix}/${name}`;
            if (!config) {
                if (receiver)
                    receiver.delete(fullName);
                continue;
            }
            if (typeof config === 'string') {
                config = {rule: config};
            } else if (!config.rule) {
                throw new Error(`Alias '${fullName}' does not specify a rule.`);
            }
            mapped.set(fullName, config);
        }
    }
    if (receiver === undefined)
        receiver = new Map();
    for (const entry of mapped) {
        let name = entry[0];
        let alias: RawConfiguration.Alias | undefined = entry[1];
        const result: Pick<RawConfiguration.Alias, 'options'> = {};
        const names = [name];
        do {
            name = alias.rule;
            if (names.includes(name))
                throw new Error(`Circular Alias: ${names.join(' => ')} => ${name}`);
            if (!('options' in result) && 'options' in alias)
                result.options = alias.options;
            names.push(name);
            alias = mapped.get(name);
        } while (alias !== undefined);
        const parent = receiver.get(name);
        if (parent) {
            receiver.set(entry[0], {...parent, ...result});
        } else {
            receiver.set(entry[0], {...result, ...resolveNameAndDirectories(name, rulesDirectoryMap)});
        }
    }
    return receiver;
}

function resolveNameAndDirectories(rule: string, rulesDirectoryMap: Configuration['rulesDirectories']) {
    const slashIndex = rule.lastIndexOf('/');
    if (slashIndex === -1)
        return {rule, rulesDirectories: undefined};
    const rulesDirectories = rulesDirectoryMap && rulesDirectoryMap.get(rule.substr(0, slashIndex));
    if (rulesDirectories === undefined)
        throw new Error(`No rulesDirectories specified for '${rule.substr(0, slashIndex)}'.`);
    return {rule: rule.substr(slashIndex + 1), rulesDirectories}; // tslint:disable-line:object-shorthand-properties-first
}

function mapRules(raw: RawConfiguration.RuleMap, aliases: Configuration['aliases'], rulesDirectoryMap: Configuration['rulesDirectories']) {
    const result = new Map<string, Configuration.RuleConfig>();
    for (const ruleName of Object.keys(raw)) {
        const alias = aliases && aliases.get(ruleName);
        result.set(ruleName, {...(alias || resolveNameAndDirectories(ruleName, rulesDirectoryMap)), ...mapRuleConfig(raw[ruleName])});
    }
    return result;
}

function mapRuleConfig(value: RawConfiguration.RuleConfigValue) {
    if (typeof value === 'string')
        return { severity: mapRuleSeverity(value) };
    if (!value)
        return {};
    const result: {options?: any, severity?: Configuration.RuleSeverity} = {};
    if ('severity' in value)
        result.severity = mapRuleSeverity(value.severity!);
    if ('options' in value)
        result.options = value.options;
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

function mapSettings(settings: RawConfiguration.SettingsMap) {
    const result = new Map<string, any>();
    for (const key of Object.keys(settings))
        result.set(key, settings[key]);
    return result;
}
