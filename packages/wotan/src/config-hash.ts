import { EffectiveConfiguration, ReducedConfiguration } from '@fimbul/ymir';
import { LinterOptions } from './linter';
import { djb2 } from './utils';

export function createConfigHash(config: ReducedConfiguration, linterOptions: LinterOptions) {
    return '' + djb2(JSON.stringify({
        rules: mapToObject(config.rules, stripRuleConfig),
        settings: mapToObject(config.settings, identity),
        ...linterOptions,
    }));
}

function mapToObject<T, U>(map: ReadonlyMap<string, T>, transform: (v: T) => U) {
    const result: Record<string, U> = {};
    for (const [key, value] of map)
        result[key] = transform(value);
    return result;
}

function identity<T>(v: T) {
    return v;
}

function stripRuleConfig({rulesDirectories: _ignored, ...rest}: EffectiveConfiguration.RuleConfig) {
    return rest;
}
