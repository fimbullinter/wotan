import { ConfigurationProvider, Resolver, LoadConfigurationContext, Configuration, CacheFactory, BuiltinResolver } from '@fimbul/ymir';
import { CachedFileSystem } from '../cached-file-system';
export interface RawConfiguration {
    aliases?: RawConfiguration.AliasMap;
    rules?: RawConfiguration.RuleMap;
    settings?: RawConfiguration.SettingsMap;
    extends?: string | ReadonlyArray<string>;
    overrides?: ReadonlyArray<RawConfiguration.Override>;
    rulesDirectories?: RawConfiguration.RulesDirectoryMap;
    exclude?: string | ReadonlyArray<string>;
    processor?: string | null | false;
}
export declare namespace RawConfiguration {
    type RuleSeverity = 'off' | 'warn' | 'warning' | 'error' | 'suggestion' | 'hint';
    interface RuleConfig {
        severity?: RuleSeverity;
        options?: any;
    }
    type RuleConfigValue = RuleSeverity | RuleConfig | null;
    interface Override {
        files: string | ReadonlyArray<string>;
        rules?: RuleMap;
        settings?: SettingsMap;
        processor?: string | null | false;
    }
    interface Alias {
        rule: string;
        options?: any;
    }
    interface RuleMap {
        [key: string]: RawConfiguration.RuleConfigValue;
    }
    interface AliasMap {
        [prefix: string]: {
            [name: string]: RawConfiguration.Alias | null | false | string;
        } | null | false;
    }
    interface RulesDirectoryMap {
        [prefix: string]: string;
    }
    interface SettingsMap {
        [key: string]: any;
    }
}
export declare const CONFIG_EXTENSIONS: string[];
export declare const CONFIG_FILENAMES: string[];
export declare class DefaultConfigurationProvider implements ConfigurationProvider {
    private fs;
    private resolver;
    private builtinResolver;
    private cache;
    constructor(fs: CachedFileSystem, resolver: Resolver, builtinResolver: BuiltinResolver, cache: CacheFactory);
    find(fileToLint: string): string | undefined;
    private findConfigForDirectory;
    resolve(name: string, basedir: string): string;
    load(filename: string, context: LoadConfigurationContext): Configuration;
    parse(raw: RawConfiguration, filename: string, context: LoadConfigurationContext): Configuration;
    read(filename: string): RawConfiguration;
    private mapOverride;
    private mapProcessor;
}
