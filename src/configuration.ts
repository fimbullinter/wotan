import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as resolve from 'resolve';
import * as yaml from 'js-yaml';
import * as json5 from 'json5';
import { Minimatch } from 'minimatch';
import { ConfigurationError } from './error';
import { Configuration, RawConfiguration, EffectiveConfiguration } from './types';

declare global {
    interface NodeModule {
        paths: string[];
    }
}

export const CONFIG_EXTENSIONS = ['yaml', 'yml', 'json5', 'json', 'js'];
export const CONFIG_FILENAMES = CONFIG_EXTENSIONS.map((ext) => '.wotanrc.' + ext);

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

export function readConfigFile(filename: string): RawConfiguration {
    switch (path.extname(filename)) {
        case '.json':
        case '.json5':
            try {
                return json5.parse(fs.readFileSync(filename, 'utf8'));
            } catch (e) {
                throw new ConfigurationError(`Error parsing '${filename}': ${e.message}`);
            }
        case '.yaml':
        case '.yml':
            try {
                return yaml.safeLoad(fs.readFileSync(filename, 'utf8'), {
                    schema: yaml.JSON_SCHEMA,
                    strict: true,
                });
            } catch (e) {
                throw new ConfigurationError(`Error parsing '${filename}': ${e.message}`);
            }
        default:
            delete require.cache[filename];
            return require(filename);
    }
}

export function resolveConfigFile(name: string, basedir: string): string {
    if (name.startsWith('wotan:')) {
        try {
            return require.resolve(`./configs/${name.substr('wotan:'.length)}`);
        } catch {
            throw new ConfigurationError(`'${name}' is not a valid builtin configuration, try 'wotan:recommended'.`);
        }
    }
    try {
        return resolve.sync(name, {
            basedir,
            extensions: CONFIG_EXTENSIONS,
            paths: module.paths.slice(1), // fall back to search relative to executable
        });
    } catch (e) {
        throw new ConfigurationError(e.message);
    }
}

function arrayify<T>(maybeArr: T | T[] | undefined): T[] {
    return Array.isArray(maybeArr)
        ? maybeArr
        : maybeArr === undefined
            ? []
            : [maybeArr];
}

export function parseConfigFile(raw: RawConfiguration, filename: string, cascade?: boolean): Configuration {
    return parseConfigWorker(raw, filename, [filename], cascade);
}

function parseConfigWorker(raw: RawConfiguration, filename: string, stack: string[], cascade?: boolean): Configuration {
    const dirname = path.dirname(filename);
    let base = arrayify(raw.extends).map((name) => {
        name = resolveConfigFile(name, dirname);
        if (stack.includes(name))
            throw new ConfigurationError(`Circular configuration dependency ${stack.join(' => ')} => ${name}`);
        return parseConfigWorker(readConfigFile(name), name, [...stack, name]);
    });
    if (cascade && !raw.root) {
        const next = findupConfig(dirname);
        if (next !== undefined)
            base = [parseConfigFile(readConfigFile(next), next, true), ...base];
    }
    return {
        filename,
        extends: base,
        overrides: raw.overrides && raw.overrides.map(mapOverride),
        rules: raw.rules && mapRules(raw.rules),
        rulesDirectory: raw.rulesDirectory && mapRulesDirectory(raw.rulesDirectory, dirname),
        processor: raw.processor === undefined ? undefined : path.resolve(filename, raw.processor),
        exclude: Array.isArray(raw.exclude) ? raw.exclude : raw.exclude === undefined ? undefined : [raw.exclude],
        settings: raw.settings,
    };
}

function mapOverride(raw: RawConfiguration.Override): Configuration.Override {
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

function mapRules(raw: {[name: string]: RawConfiguration.RuleConfigValue}) {
    const result: {[name: string]: Configuration.RuleConfig} = {};
    for (const key of Object.keys(raw))
        result[key] = mapRuleConfig(raw[key]);
    return result;
}

function mapRuleConfig(value: RawConfiguration.RuleConfigValue): Configuration.RuleConfig {
    if (typeof value === 'string')
        return { severity: value === 'warn' ? 'warning' : value };
    const result: Configuration.RuleConfig = {};
    if ('options' in value)
        result.options = value.options;
    if ('severity' in value)
        result.severity = value.severity === 'warn' ? 'warning' : value.severity;
    return result;
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
    for (const name of CONFIG_FILENAMES)
        if (entries.includes(name))
            return name;
    return;
}

export function reduceConfigurationForFile(config: Configuration, filename: string) {
    return reduceConfig(config, path.resolve(filename), {
        rules: new Map(),
        settings: new Map(),
        rulesDirectories: new Map(),
        processors: [],
    });
}

function reduceConfig(config: Configuration, filename: string, receiver: EffectiveConfiguration): EffectiveConfiguration | undefined {
    const relativeFilename = path.relative(path.dirname(config.filename), filename);
    if (config.exclude !== undefined && matchesGlobs(relativeFilename, config.exclude, false))
            return;
    for (const base of config.extends)
        if (reduceConfig(base, filename, receiver) === undefined)
            return;

    if (config.processor !== undefined)
        receiver.processors.unshift(config.processor);
    if (config.rulesDirectory !== undefined)
        extendRulesDirectories(receiver.rulesDirectories, config.rulesDirectory);

    extendConfig(receiver, config);
    if (config.overrides !== undefined)
        for (const override of config.overrides)
            if (matchesGlobs(relativeFilename, override.files, true))
                extendConfig(receiver, override);
    return receiver;
}

function matchesGlobs(file: string, patterns: string[], matchBase: boolean): boolean {
    let result = false;
    for (let pattern of patterns) {
        const negate = pattern[0] === '!';
        if (negate)
            pattern = pattern.substr(1);
        const local = pattern.startsWith('./');
        if (local)
            pattern = pattern.substr(2);
        if (new Minimatch(pattern, {matchBase: matchBase && !local}).match(file))
            result = negate;
    }
    return result;
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

function extendConfig(receiver: EffectiveConfiguration, {rules, settings}: Partial<Configuration | Configuration.Override>) {
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
