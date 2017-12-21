import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as resolve from 'resolve';
import * as yaml from 'js-yaml';
import * as json5 from 'json5';
import { Minimatch } from 'minimatch';
import { ConfigurationError } from './error';
import { Configuration, RawConfiguration, EffectiveConfiguration } from './types';
import * as isNegated from 'is-negated-glob';
import { resolveExecutable, OFFSET_TO_NODE_MODULES } from './utils';

declare global {
    interface NodeModule {
        paths: string[];
    }
}

export const CONFIG_EXTENSIONS = ['yaml', 'yml', 'json5', 'json', 'js'];
export const CONFIG_FILENAMES = CONFIG_EXTENSIONS.map((ext) => '.wotanrc.' + ext);

export function findConfigurationPath(filename: string, cwd = process.cwd()): string | undefined {
    return findupConfig(path.resolve(cwd, filename));
}

export function findConfiguration(filename: string, cwd?: string): Configuration | undefined {
    let config = findConfigurationPath(filename, cwd);
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
            paths: module.paths.slice(OFFSET_TO_NODE_MODULES), // fall back to search relative to executable
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
        overrides: raw.overrides && raw.overrides.map(mapOverride, path.dirname(filename)),
        rules: raw.rules && mapRules(raw.rules),
        rulesDirectories: raw.rulesDirectories && mapRulesDirectory(raw.rulesDirectories, dirname),
        processor: raw.processor === undefined ? undefined : resolveExecutable(raw.processor, path.dirname(filename)),
        exclude: Array.isArray(raw.exclude) ? raw.exclude : raw.exclude === undefined ? undefined : [raw.exclude],
        settings: raw.settings,
    };
}

function mapOverride(this: string, raw: RawConfiguration.Override): Configuration.Override {
    return {
        files: arrayify(raw.files),
        rules: raw.rules && mapRules(raw.rules),
        settings: raw.settings,
        processor: raw.processor && resolveExecutable(raw.processor, this),
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

export function reduceConfigurationForFile(config: Configuration, filename: string, cwd = process.cwd()) {
    return reduceConfig(config, path.resolve(cwd, filename), new Map(), {
        rules: new Map(),
        settings: new Map(),
        processor: undefined,
    });
}

type RulesDirectoryMap = Map<string, string[]>;

function reduceConfig(
    config: Configuration,
    filename: string,
    rulesDirectories: RulesDirectoryMap,
    receiver: EffectiveConfiguration,
): EffectiveConfiguration | undefined {
    const relativeFilename = path.relative(path.dirname(config.filename), filename);
    if (config.exclude !== undefined && matchesGlobs(relativeFilename, config.exclude, false))
            return;
    for (const base of config.extends) {
        const tmpRulesDirs: RulesDirectoryMap = new Map();
        if (reduceConfig(base, filename, tmpRulesDirs, receiver) === undefined)
            return;
        extendRulesDirectories(rulesDirectories, tmpRulesDirs, identityFn);
    }

    if (config.rulesDirectories !== undefined)
        extendRulesDirectories(rulesDirectories, config.rulesDirectories, arrayFn);

    extendConfig(receiver, config, rulesDirectories);
    if (config.overrides !== undefined)
        for (const override of config.overrides)
            if (matchesGlobs(relativeFilename, override.files, true))
                extendConfig(receiver, override, rulesDirectories);
    return receiver;
}

function matchesGlobs(file: string, patterns: string[], matchBase: boolean): boolean {
    for (let i = patterns.length - 1; i >= 0; --i) {
        const glob = isNegated(patterns[i]);
        const local = glob.pattern.startsWith('./');
        if (local)
            glob.pattern = glob.pattern.substr(2);
        if (new Minimatch(glob.pattern, {matchBase: matchBase && !local}).match(file))
            return !glob.negated;
    }
    return false;
}

function identityFn<T>(v: T): T {
    return v;
}

function arrayFn<T>(v: T): T[] {
    return [v];
}

function extendRulesDirectories<T extends string | string[]>(
    receiver: Map<string, string[]>,
    current: Map<string, T>,
    mapFn: (v: T) => string[],
) {
    current.forEach((dir, key) => {
        const prev = receiver.get(key);
        if (prev !== undefined) {
            prev.unshift(...mapFn(dir));
        } else {
            receiver.set(key, mapFn(dir));
        }
    });
}

function extendConfig(
    receiver: EffectiveConfiguration,
    {processor, rules, settings}: Partial<Configuration | Configuration.Override>,
    rulesDirectoryMap: RulesDirectoryMap,
) {
    if (processor !== undefined)
        receiver.processor = processor;
    if (rules !== undefined) {
        for (const key of Object.keys(rules)) {
            const slashPos = key.lastIndexOf('/');
            const rulesDirectories = slashPos === -1 ? undefined : rulesDirectoryMap.get(key.substr(0, slashPos));
            const prev = receiver.rules.get(key);
            receiver.rules.set(key, {severity: 'error', options: undefined, ...prev, ...rules[key], rulesDirectories});
        }
    }
    if (settings !== undefined)
        for (const key of Object.keys(settings))
            receiver.settings.set(key, settings[key]);
}
