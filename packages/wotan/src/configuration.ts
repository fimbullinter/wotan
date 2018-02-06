import * as path from 'path';
import { Minimatch } from 'minimatch';
import { Configuration, EffectiveConfiguration, GlobalSettings, ReducedConfiguration } from './types';
import * as isNegated from 'is-negated-glob';

// @internal
export function reduceConfigurationForFile(config: Configuration, filename: string, cwd: string): ReducedConfiguration | undefined {
    return reduceConfig(config, path.resolve(cwd, filename), {rules: new Map(), settings: new Map(), processor: undefined});
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
        if (new Minimatch(glob.pattern, {matchBase: !local}).match(file))
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

// @internal
export function getProcessorForFile(config: Configuration, fileName: string, cwd: string) {
    return findProcessorInConfig(config, path.resolve(cwd, fileName)) || undefined;
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

// @internal
export function getSettingsForFile(config: Configuration, fileName: string, cwd: string): GlobalSettings {
    const result = new Map<string, any>();
    reduceSettings(config, path.resolve(cwd, fileName), result);
    return result;
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
}
