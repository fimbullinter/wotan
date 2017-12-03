import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { EffectiveConfig, RuleSeverity } from './configuration';

const CORE_RULES_DIRECTORY = path.join(__dirname, 'rules');
const RULE_CACHE = new Map<string, RuleConstructor | null>();

export function lint(file: ts.SourceFile, config: EffectiveConfig) {
    const result: Failure[] = [];
    config.rules.forEach(({severity}, ruleName) => {
        if (severity === 'off')
            return;
        const rule = getRule(ruleName, config);
        for (const failure of rule.apply(file))
            result.push({
                severity,
                ruleName,
                fileName: file.fileName,
                ...failure,
            });
    });
    return result;
}

interface RuleConstructor {
    new(options: any, settings: Map<string, any>): Rule;
}

interface Rule {
    apply(sourceFile: ts.SourceFile): RuleFailure[];
}

export interface RuleFailure {
    start: number;
    end: number;
    message: string;
    // TODO fix?: ???
}

export namespace Failure {
    export function compare(a: Failure, b: Failure): number {
        return a.fileName === b.fileName
            ? a.start - b.start
            : a.fileName < b.fileName
                ? -1
                : 1;
    }
}

export interface Failure extends RuleFailure {
    fileName: string;
    ruleName: string;
    severity: RuleSeverity;
}

function getRule(name: string, config: EffectiveConfig) {
    const ctor = findRule(name, config.rulesDirectories);
    const options = config.rules.get(name)!.options;
    return new ctor(options, config.settings);
}

function findRule(name: string, rulesDirectories: EffectiveConfig['rulesDirectories']): RuleConstructor {
    const slashIndex = name.lastIndexOf('/');
    if (slashIndex === -1) {
        const ctor = loadCachedRule(path.join(CORE_RULES_DIRECTORY, name), loadCoreRule);
        if (ctor === undefined)
            throw new Error(`Could not find core rule '${name}'.`);
        return ctor;
    }
    const prefix = name.substr(0, slashIndex);
    const directories = rulesDirectories.get(prefix);
    if (directories === undefined)
        throw new Error(`No 'rulesDirectory' for prefix '${prefix}'.`);
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
    const loaded = load(filename);
    RULE_CACHE.set(filename, loaded === undefined ? null : loaded); // tslint:disable-line:no-null-keyword
    return loaded;
}

function loadCoreRule(filename: string): RuleConstructor | undefined {
    filename = filename + '.js';
    if (!fs.existsSync(filename))
        return;
    return require(filename).Rule;
}

function loadCustomRule(filename: string): RuleConstructor | undefined {
    try {
        filename = require.resolve(filename);
    } catch {
        return;
    }
    return require(filename).Rule;
}
