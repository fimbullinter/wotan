import { injectable } from 'inversify';
import { ConfigurationProvider, Resolver, Configuration, CacheFactory, Cache } from '@fimbul/wotan';
import * as TSLint from 'tslint';
import * as path from 'path';

/**
 * Number of .. until the containing node_modules.
 * __dirname -> src
 * ..        -> project root
 * ../..     -> node_modules (or @scope)
 * ../../..  -> node_modules if @scoped package
 */
const OFFSET_TO_NODE_MODULES = 3;

@injectable()
export class TslintConfigurationProvider implements ConfigurationProvider {
    private cache: Cache<string, string | undefined>;
    private tslintConfigDir: string | undefined;
    constructor(private resolver: Resolver, cache: CacheFactory) {
        this.cache = cache.create();
    }

    public find(fileName: string) {
        fileName = path.dirname(fileName);
        let result = this.cache.get(fileName);
        if (result === undefined && !this.cache.has(fileName)) {
            result = TSLint.Configuration.findConfigurationPath(null, fileName); // tslint:disable-line:no-null-keyword
            const {root} = path.parse(fileName);
            // prevent infinite loop when result is on different drive
            const configDirname = result === undefined || root !== path.parse(result).root ? root : path.dirname(result);
            this.cache.set(fileName, result);
            while (fileName !== configDirname) {
                this.cache.set(fileName, result);
                fileName = path.dirname(fileName);
            }
        }
        return result;
    }

    public resolve(name: string, basedir: string) {
        const extensions = Object.keys(require.extensions).filter((e) => e !== '.node');
        if (name.startsWith('tslint:')) {
            try {
                if (this.tslintConfigDir === undefined)
                    this.tslintConfigDir = path.join(
                        this.resolver.resolve('tslint', path.dirname(__dirname), extensions),
                        '../configs',
                    );
                return this.resolver.resolve(path.join(this.tslintConfigDir, name.substr('tslint:'.length)), '', extensions);
            } catch {
                throw new Error(`'${name}' is not a valid builtin configuration, try 'tslint:recommended.'`);
            }
        }
        return this.resolver.resolve(
            name,
            basedir,
            extensions,
            module.paths.slice(OFFSET_TO_NODE_MODULES),
        );
    }

    public load(filename: string): Configuration {
        return this.parse(TSLint.Configuration.loadConfigurationFromPath(filename), filename);
    }

    public parse(raw: TSLint.Configuration.IConfigurationFile, filename: string): Configuration {
        const rulesDirectories = raw.rulesDirectory.length === 0 ? undefined : raw.rulesDirectory;
        const overrides: Configuration.Override[] = [];
        if (raw.rules.size !== 0)
            overrides.push({
                files: ['*', '.*', '!*.js?(x)'],
                rules: new Map(Array.from(raw.rules, mapRules)),
            });
        if (raw.jsRules.size !== 0)
            overrides.push({
                files: ['*.js?(x)', '.*.js?(x)'],
                rules: new Map(Array.from(raw.jsRules, mapRules)),
            });
        return {
            overrides,
            filename,
            extends: [],
            exclude: raw.linterOptions && raw.linterOptions.exclude && mapExcludes(raw.linterOptions.exclude, path.dirname(filename)),
        };

        function mapRules([rule, config]: [string, Partial<TSLint.IOptions>]): [string, Configuration.RuleConfig] {
            return [
                rule,
                {
                    rule,
                    rulesDirectories,
                    severity: config.ruleSeverity,
                    options: config.ruleArguments,
                },
            ];
        }
    }
}

function mapExcludes(excludes: Iterable<string>, configDir: string) {
    const result = [];
    for (const e of excludes)
        result.push(path.relative(configDir, e));
    return result;
}
