import { RuleConstructor, EffectiveConfiguration } from './types';
import * as path from 'path';
import * as fs from 'fs';
import * as debug from 'debug';

const log = debug('wotan:ruleLoader');

const CORE_RULES_DIRECTORY = path.join(__dirname, 'rules');
const RULE_CACHE = new Map<string, RuleConstructor | null>();

// @internal
export function findRule(name: string, directories: EffectiveConfiguration.RuleConfig['rulesDirectories']): RuleConstructor {
    const slashIndex = name.lastIndexOf('/');
    if (slashIndex === -1) {
        const ctor = loadCachedRule(path.join(CORE_RULES_DIRECTORY, name), loadCoreRule);
        if (ctor === undefined)
            throw new Error(`Could not find core rule '${name}'.`);
        return ctor;
    }
    if (directories === undefined)
        throw new Error(`No 'rulesDirectories' for rule '${name}'.`);
    name = name.substr(slashIndex + 1);
    for (const dir of directories) {
        const ctor = loadCachedRule(path.join(dir, name), loadCustomRule);
        if (ctor !== undefined)
            return ctor;
    }
    throw new Error(`Could not find rule '${name}' in ${directories}`);
}

function loadCachedRule(filename: string, load: typeof loadCoreRule | typeof loadCustomRule) {
    const cached = RULE_CACHE.get(filename);
    if (cached !== undefined)
        return cached === null ? undefined : cached;
    log('Rule %s not in cache', filename);
    const loaded = load(filename);
    RULE_CACHE.set(filename, loaded === undefined ? null : loaded); // tslint:disable-line:no-null-keyword
    return loaded;
}

function loadCoreRule(filename: string): RuleConstructor | undefined {
    filename = filename + '.js';
    if (!fs.existsSync(filename))
        return;
    log('Found %s', filename);
    return require(filename).Rule;
}

function loadCustomRule(filename: string): RuleConstructor | undefined {
    log('Search implementation of rule %s', filename);
    try {
        filename = require.resolve(filename);
    } catch {
        return;
    }
    console.log('Found %s', filename);
    return require(filename).Rule;
}
