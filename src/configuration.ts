import * as path from 'path';
import { Minimatch } from 'minimatch';
import { ConfigurationError } from './error';
import { Configuration, EffectiveConfiguration } from './types';
import * as isNegated from 'is-negated-glob';

// @internal
export function reduceConfigurationForFile(config: Configuration, filename: string, cwd: string) {
    return reduceConfig(config, path.resolve(cwd, filename), new Map(), new Map(), {
        rules: new Map(),
        settings: new Map(),
        processor: undefined,
    });
}

type RulesDirectoryMap = Map<string, string[]>;
interface ResolvedAlias extends Configuration.Alias {
    rulesDirectories: string[] | undefined;
}
interface ReducedAlias extends ResolvedAlias {
    aliases: AliasMap;
}
type AliasMap = Map<string, ReducedAlias | null>;

function reduceConfig(
    config: Configuration,
    filename: string,
    rulesDirectories: RulesDirectoryMap,
    aliases: AliasMap,
    receiver: EffectiveConfiguration,
): EffectiveConfiguration | undefined {
    const relativeFilename = path.relative(path.dirname(config.filename), filename);
    if (config.exclude && matchesGlobs(relativeFilename, config.exclude))
            return;
    for (const base of config.extends) {
        const tmpRulesDirs: RulesDirectoryMap = new Map();
        const tmpAliases: AliasMap = new Map();
        if (reduceConfig(base, filename, tmpRulesDirs, tmpAliases, receiver) === undefined)
            return;
        extendRulesDirectories(rulesDirectories, tmpRulesDirs, identityFn);
        for (const [name, alias] of tmpAliases)
            aliases.set(name, alias);
    }

    if (config.rulesDirectories)
        extendRulesDirectories(rulesDirectories, config.rulesDirectories, arrayFn);
    if (config.aliases) {
        for (const name of Object.keys(config.aliases)) {
            const options = config.aliases[name];
            aliases.set(name, options && {
                ...options,
                aliases,
                rulesDirectories: getRulesDirectoriesByName(options.rule, rulesDirectories),
            });
        }
    }

    extendConfig(receiver, config, rulesDirectories, aliases);
    if (config.overrides)
        for (const override of config.overrides)
            if (matchesGlobs(relativeFilename, override.files))
                extendConfig(receiver, override, rulesDirectories, aliases);
    return receiver;
}

function matchesGlobs(file: string, patterns: string[]): boolean {
    for (let i = patterns.length - 1; i >= 0; --i) {
        const glob = isNegated(patterns[i]);
        const local = glob.pattern.startsWith('./');
        if (local)
            glob.pattern = glob.pattern.substr(2);
        if (new Minimatch(glob.pattern, {matchBase: !local}).match(file))
            return !glob.negated;
    }
    return false;
}

function getRulesDirectoriesByName(name: string, rulesDirectories: RulesDirectoryMap) {
    const slashIndex = name.lastIndexOf('/');
    return slashIndex === -1 ? undefined : rulesDirectories.get(name.substr(0, slashIndex));
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
    for (const [key, dir] of current) {
        const prev = receiver.get(key);
        if (prev !== undefined) {
            prev.unshift(...mapFn(dir));
        } else {
            receiver.set(key, mapFn(dir).slice());
        }
    }
}

function extendConfig(
    receiver: EffectiveConfiguration,
    {processor, rules, settings}: Partial<Configuration | Configuration.Override>,
    rulesDirectoryMap: RulesDirectoryMap,
    aliases: AliasMap,
) {
    if (processor !== undefined)
        receiver.processor = processor;
    if (rules) {
        for (const key of Object.keys(rules)) {
            const prev = receiver.rules.get(key);
            receiver.rules.set(key, {
                severity: 'error',
                options: undefined,
                ...prev,
                rulesDirectories: getRulesDirectoriesByName(key, rulesDirectoryMap),
                ...resolveAlias(key, aliases),
                ...rules[key],
            });
        }
    }
    if (settings)
        for (const key of Object.keys(settings))
            receiver.settings.set(key, settings[key]);
}

function resolveAlias(rule: string, aliases: AliasMap) {
    let next = aliases.get(rule);
    if (!next)
        return { rule };
    const names = [];
    let startIndex = 0;
    const result: ResolvedAlias = {
        rule,
        rulesDirectories: undefined,
    };
    do {
        names.push(rule);
        if (next.rule === rule)
            throw new ConfigurationError(`Circular alias: ${names.join(' => ')} => ${next.rule}.`);
        if (next.aliases !== aliases) {
            startIndex = names.length - 1;
            aliases = next.aliases;
        } else if (names.includes(next.rule, startIndex)) {
            throw new ConfigurationError(`Circular alias: ${names.join(' => ')} => ${next.rule}.`);
        }
        result.rule = next.rule;
        result.rulesDirectories = next.rulesDirectories;
        if ('options' in next && !('options' in result))
            result.options = next.options;
        rule = next.rule;
        next = aliases.get(rule);
    } while (next);

    return result;
}

// @internal
export function getProcessorForFile(config: Configuration, fileName: string, cwd: string) {
    return findProcessorInConfig(config, path.resolve(cwd, fileName)) || undefined;
}

function findProcessorInConfig(config: Configuration, fileName: string): string | undefined {
    if (config.overrides) {
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
