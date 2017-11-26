import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as resolve from 'resolve';
import * as yaml from 'js-yaml';
import * as json5 from 'json5';
import * as multimatch from 'multimatch';

declare global {
    interface NodeModule {
        paths: string[];
    }
}

export const CONFIG_EXTENSIONS = ['yaml', 'yml', 'json5', 'json', 'js'];

export type RuleSeverity = 'off' | 'warn' | 'error';

export interface RuleConfig {
    severity?: RuleSeverity;
    options?: any;
}

export type RuleConfigValue = RuleSeverity | RuleConfig;

export interface RawConfigBase {
    rules?: {[key: string]: RuleConfigValue};
    settings?: {[key: string]: any};
}

export interface RawOverride extends RawConfigBase {
    files: string | string[];
}

export interface RawConfig extends RawConfigBase {
    extends?: string | string[];
    root?: boolean;
    overrides?: RawOverride[];
    rulesDirectory?: {[prefix: string]: string};
    exclude?: string | string[];
    processor?: string;
}

export interface BaseConfiguration {
    rules: {[key: string]: RuleConfig} | undefined;
    settings: {[key: string]: any} | undefined;
}

export interface Configuration extends BaseConfiguration {
    filename: string;
    overrides: Override[] | undefined;
    base: Configuration[];
    rulesDirectory: Map<string, string> | undefined;
    processor: string | undefined;
    exclude: string[] | undefined;
}

export interface Override extends BaseConfiguration {
    files: string[];
}

export function findConfigurationPath(filename: string): string | undefined {
    return findupConfig(path.resolve(filename));
}

export function findConfiguration(filename: string): Configuration | undefined {
    let config = findConfigurationPath(filename);
    let cascade = true;
    if (config === undefined) {
        cascade = false;
        const homedir = os.homedir();
        config = findConfigFileInDirectory(homedir);
        if (config !== undefined)
            config = path.join(homedir, config);
    }
    return config === undefined ? undefined : parseConfigFile(readConfigFile(config), config, cascade);
}

export function readConfigFile(filename: string): RawConfig {
    switch (path.extname(filename)) {
        case '.json':
        case '.json5':
            return json5.parse(fs.readFileSync(filename, 'utf8'));
        case '.yaml':
        case '.yml':
            return yaml.safeLoad(fs.readFileSync(filename, 'utf8'), {
                filename,
                schema: yaml.JSON_SCHEMA,
                strict: true,
            });
        default:
            delete require.cache[filename];
            return require(filename);
    }
}

export function resolveConfigFile(name: string, basedir: string): string {
    if (name.startsWith('wotan:'))
        return require.resolve(`./configs/${name.substr('wotan:'.length)}`);
    return resolve.sync(name, {
        basedir,
        extensions: CONFIG_EXTENSIONS,
        paths: module.paths.slice(1), // fall back to search relative to executable
    });
}

function arrayify<T>(maybeArr: T | T[] | undefined): T[] {
    return Array.isArray(maybeArr)
        ? maybeArr
        : maybeArr === undefined
            ? []
            : [maybeArr];
}

export function parseConfigFile(raw: RawConfig, filename: string, cascade?: boolean): Configuration {
    return parseConfigWorker(raw, filename, [filename], cascade);
}

function parseConfigWorker(raw: RawConfig, filename: string, stack: string[], cascade?: boolean): Configuration {
    const dirname = path.dirname(filename);
    let base = arrayify(raw.extends).map((name) => {
        name = resolveConfigFile(name, dirname);
        if (stack.includes(name))
            throw new Error(`Circular configuration dependency ${stack.join(' => ')} => ${name}`);
        return parseConfigWorker(readConfigFile(name), name, [...stack, name]);
    });
    if (cascade && !raw.root) {
        const next = findupConfig(dirname);
        if (next !== undefined)
            base = [parseConfigFile(readConfigFile(next), next, true), ...base];
    }
    return {
        base,
        filename,
        overrides: raw.overrides && raw.overrides.map(mapOverride),
        rules: raw.rules && mapRules(raw.rules),
        rulesDirectory: raw.rulesDirectory && mapRulesDirectory(raw.rulesDirectory, dirname),
        processor: raw.processor === undefined ? undefined : path.resolve(filename, raw.processor),
        exclude: Array.isArray(raw.exclude) ? raw.exclude : raw.exclude === undefined ? undefined : [raw.exclude],
        settings: raw.settings,
    };
}

function mapOverride(raw: RawOverride): Override {
    return {
        files: arrayify(raw.files),
        rules: raw.rules && mapRules(raw.rules),
        settings: raw.settings,
    };
}

function mapRulesDirectory(raw: {[prefix: string]: string}, dirname: string) {
    const result = new Map<string, string>();
    for (const key of Object.keys(raw))
        result.set(key, path.resolve(dirname, raw[key]));
    return result;
}

function mapRules(raw: {[name: string]: RuleConfigValue}) {
    const result: {[name: string]: RuleConfig} = {};
    for (const key of Object.keys(raw))
        result[key] = mapRuleConfig(raw[key]);
    return result;
}

function mapRuleConfig(value: RuleConfigValue): RuleConfig {
    return typeof value === 'string'
        ? { severity: value }
        : value;
}

function findupConfig(current: string): string | undefined {
    let next = path.dirname(current);
    while (next !== current) {
        current = next;
        const config = findConfigFileInDirectory(current);
        if (config !== undefined)
            return path.join(current, config);
        next = path.dirname(next);
    }
    return;
}

function findConfigFileInDirectory(dir: string): string | undefined {
    const entries = fs.readdirSync(dir);
    for (const ext of CONFIG_EXTENSIONS) {
        if (entries.includes(`.wotanrc.${ext}`))
            return `.wotanrc.${ext}`;
        if (entries.includes(`wotanrc.${ext}`))
            return `wotanrc.${ext}`;
    }
    return;
}

export interface EffectiveRuleConfig {
    severity: RuleSeverity;
    options: any;
}

export interface EffectiveConfig {
    rules: Map<string, EffectiveRuleConfig>;
    settings: Map<string, any>;
    rulesDirectories: Map<string, string[]>;
    processors: string[];
}

export function reduceConfigurationForFile(config: Configuration, filename: string) {
    return reduceConfig(config, path.resolve(filename), {
        rules: new Map(),
        settings: new Map(),
        rulesDirectories: new Map(),
        processors: [],
    });
}

function reduceConfig(config: Configuration, filename: string, receiver: EffectiveConfig): EffectiveConfig | undefined {
    const relativeFilename = path.relative(path.dirname(config.filename), filename);
    if (config.exclude !== undefined && matchesGlobs(relativeFilename, config.exclude))
            return;
    for (const base of config.base)
        if (reduceConfig(base, filename, receiver) === undefined)
            return;

    if (config.processor !== undefined)
        receiver.processors.unshift(config.processor);
    if (config.rulesDirectory !== undefined)
        extendRulesDirectories(receiver.rulesDirectories, config.rulesDirectory);

    extendConfig(receiver, config);
    if (config.overrides !== undefined)
        for (const override of config.overrides)
            if (matchesGlobs(relativeFilename, override.files))
                extendConfig(receiver, override);
    return receiver;
}

function matchesGlobs(file: string, patterns: string[]): boolean {
    return multimatch([file], patterns).length !== 0;
}

function extendRulesDirectories(receiver: Map<string, string[]>, current: Map<string, string>) {
    current.forEach((dir, key) => {
        const prev = receiver.get(key);
        if (prev !== undefined) {
            prev.unshift(dir);
        } else {
            receiver.set(key, [dir]);
        }
    });
}

function extendConfig(receiver: EffectiveConfig, {rules, settings}: Partial<BaseConfiguration>) {
    if (rules !== undefined) {
        for (const key of Object.keys(rules)) {
            const prev = receiver.rules.get(key);
            receiver.rules.set(key, {severity: 'error', options: undefined, ...prev, ...rules[key]});
        }
    }
    if (settings !== undefined)
        for (const key of Object.keys(settings))
            receiver.settings.set(key, settings[key]);
}
