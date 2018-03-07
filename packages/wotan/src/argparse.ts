import { Command, CommandName, TestCommand, ShowCommand, ValidateCommand, BaseLintCommand } from './commands';
import { ConfigurationError, Format, GlobalOptions } from '@fimbul/ymir';
import { LintOptions } from './runner';
import debug = require('debug');

const log = debug('wotan:argparse');

// @internal
export function parseArguments(args: string[], globalOptions?: GlobalOptions): Command {
    args = args.map(trimSingleQuotes);
    const commandName = <CommandName>args[0];
    let command: Command;
    let defaults: ParsedGlobalOptions | undefined;
    switch (commandName) {
        case CommandName.Lint:
            command = parseLintCommand(args.slice(1), defaults = parseGlobalOptions(globalOptions), CommandName.Lint);
            break;
        case CommandName.Save:
            command = parseLintCommand(args.slice(1), defaults = parseGlobalOptions(globalOptions), CommandName.Save);
            break;
        default:
            command = // wotan-disable-next-line no-useless-assertion
                parseLintCommand(<AssertNever<typeof commandName>>args, defaults = parseGlobalOptions(globalOptions), CommandName.Lint);
            break;
        case CommandName.Test:
            command = parseTestCommand(args.slice(1));
            break;
        case CommandName.Show:
            command = parseShowCommand(args.slice(1), defaults = parseGlobalOptions(globalOptions));
            break;
        case CommandName.Validate:
            command = parseValidateCommand(args.slice(1));
    }
    log("Parsed '%s' command as %O", command.command, command);
    if (defaults !== undefined)
        log('used defaults %O', defaults);
    return command;
}

export interface ParsedGlobalOptions extends LintOptions {
    modules: string[];
    formatter: string | undefined;
}

export function parseGlobalOptions(options: GlobalOptions | undefined): ParsedGlobalOptions {
    if (options === undefined)
        return {
            modules: [],
            config: undefined,
            files: [],
            exclude: [],
            project: undefined,
            formatter: undefined,
            fix: false,
            extensions: undefined,
        };
    return {
        modules: expectStringOrStringArray(options, 'modules') || [],
        config: expectStringOption(options, 'config'),
        files: expectStringOrStringArray(options, 'files') || [],
        exclude: expectStringOrStringArray(options, 'exclude') || [],
        project: expectStringOption(options, 'project'),
        formatter: expectStringOption(options, 'formatter'),
        fix: expectBooleanOrNumberOption(options, 'fix'),
        extensions: (expectStringOrStringArray(options, 'extensions') || []).map(sanitizeExtensionArgument),
    };
}

function expectStringOrStringArray(options: GlobalOptions, option: string): string[] | undefined {
    const value = options[option];
    if (Array.isArray(value) && value.every((v) => typeof v === 'string'))
        return value;
    if (typeof value === 'string')
        return [value];
    if (value !== undefined)
        log("Expected a value of type 'string | string[]' for option '%s'.", option);
    return;
}
function expectStringOption(options: GlobalOptions, option: string): string | undefined {
    const value = options[option];
    if (typeof value === 'string')
        return value;
    if (value !== undefined)
        log("Expected a value of type 'string' for option '%s'.", option);
    return;
}
function expectBooleanOrNumberOption(options: GlobalOptions, option: string): boolean | number {
    const value = options[option];
    if (typeof value === 'boolean' || typeof value === 'number')
        return value;
    if (value !== undefined)
        log("Expected a value of type 'boolean | number' for option '%s'.", option);
    return false;
}

type AssertNever<T extends never> = T;

function parseLintCommand<T extends CommandName.Lint | CommandName.Save>(
    args: string[],
    defaults: ParsedGlobalOptions,
    command: T,
): BaseLintCommand<T> {
    const result: BaseLintCommand<T> = {
        command,
        ...defaults,
    };

    const exclude: string[] = [];
    const extensions: string[] = [];
    const modules: string[] = [];
    const files: string[] = [];

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-p':
            case '--project':
                result.project = expectStringArgument(args, ++i, arg) || undefined;
                break;
            case '-e':
            case '--exclude':
                result.exclude = exclude;
                const opt = expectStringArgument(args, ++i, arg);
                if (opt !== '')
                    exclude.push(opt);
                break;
            case '-f':
            case '--formatter':
                result.formatter = expectStringArgument(args, ++i, arg) || undefined;
                break;
            case '-c':
            case '--config':
                result.config = expectStringArgument(args, ++i, arg) || undefined;
                break;
            case '--fix':
                ({index: i, argument: result.fix} = parseOptionalBooleanOrNumber(args, i));
                break;
            case '--ext':
                result.extensions = extensions;
                extensions.push(...expectStringArgument(args, ++i, arg).split(/,/g).map(sanitizeExtensionArgument).filter(isTruthy));
                break;
            case '-m':
            case '--module':
                result.modules = modules;
                modules.push(...expectStringArgument(args, ++i, arg).split(/,/g).filter(isTruthy));
                break;
            case '--':
                result.files = files;
                files.push(...args.slice(i + 1).filter(isTruthy));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                result.files = files;
                if (arg !== '')
                    files.push(arg);
        }
    }

    if (result.extensions !== undefined) {
        if (result.extensions.length === 0) {
            result.extensions = undefined;
        } else if (result.project !== undefined || result.files.length === 0) {
            throw new ConfigurationError("Options '--ext' and '--project' cannot be used together.");
        }
    }

    return result;
}

function isTruthy(v: string): boolean {
    return v !== '';
}

function sanitizeExtensionArgument(ext: string): string {
    ext = ext.trim();
    return ext === '' || ext.startsWith('.') ? ext : `.${ext}`;
}

function parseTestCommand(args: string[]): TestCommand {
    const result: TestCommand = {
        command: CommandName.Test,
        modules: [],
        bail: false,
        files: [],
        updateBaselines: false,
        exact: false,
    };

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '--exact':
                ({index: i, argument: result.exact} = parseOptionalBoolean(args, i));
                break;
            case '--bail':
                ({index: i, argument: result.bail} = parseOptionalBoolean(args, i));
                break;
            case '-u':
            case '--update':
                ({index: i, argument: result.updateBaselines} = parseOptionalBoolean(args, i));
                break;
            case '-m':
            case '--module':
                result.modules.push(...expectStringArgument(args, ++i, arg).split(/,/g).filter(isTruthy));
                break;
            case '--':
                result.files.push(...args.slice(i + 1).filter(isTruthy));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                if (arg !== '')
                    result.files.push(arg);
        }
    }
    if (result.files.length === 0)
        throw new ConfigurationError('filename expected.');

    return result;
}

function parseShowCommand(args: string[], defaults: ParsedGlobalOptions): ShowCommand {
    const files = [];
    let modules: string[] | undefined;
    let format: Format | undefined;
    let config = defaults.config;

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-f':
            case '--format':
                format = expectFormatArgument(args, ++i, arg);
                break;
            case '-c':
            case '--config':
                config = expectStringArgument(args, ++i, arg) || undefined;
                break;
            case '-m':
            case '--module':
                if (modules === undefined)
                    modules = [];
                modules.push(...expectStringArgument(args, ++i, arg).split(/,/g).filter(isTruthy));
                break;
            case '--':
                files.push(...args.slice(i + 1).filter(isTruthy));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                if (arg !== '')
                    files.push(arg);
        }
    }
    switch (files.length) {
        case 0:
            throw new ConfigurationError('filename expected');
        case 1:
            return {
                format,
                config,
                modules: modules === undefined ? defaults.modules : modules,
                command: CommandName.Show,
                file: files[0],
            };
        default:
            throw new ConfigurationError('more than one filename provided');
    }
}

function parseValidateCommand(_args: string[]): ValidateCommand {
    throw new ConfigurationError("'validate' is not implemented yet.");
}

function parseOptionalBooleanOrNumber(args: string[], index: number): {index: number, argument: boolean | number} {
    if (index + 1 !== args.length) {
        switch (args[index + 1]) {
            case 'true':
                return {index: index + 1, argument: true};
            case 'false':
                return {index: index + 1, argument: false};
            default: {
                const num = parseInt(args[index + 1], 10);
                if (!Number.isNaN(num))
                    return {index: index + 1, argument: num};
            }
        }
    }
    return {index, argument: true};
}

function parseOptionalBoolean(args: string[], index: number): {index: number, argument: boolean} {
    if (index + 1 !== args.length) {
        switch (args[index + 1]) {
            case 'true':
                return {index: index + 1, argument: true};
            case 'false':
                return {index: index + 1, argument: false};
        }
    }
    return {index, argument: true};
}

function expectFormatArgument(args: string[], index: number, opt: string): Format {
    const arg = <Format>expectStringArgument(args, index, opt).toLowerCase();
    switch (arg) {
        case Format.Json:
        case Format.Json5:
        case Format.Yaml:
            return arg;
        default:
            return assertNever(arg, `Argument for option '${opt}' must be one of '${Format.Json}', '${Format.Json5}' or '${Format.Yaml}'.`);
    }
}

function expectStringArgument(args: string[], index: number, opt: string): string {
    if (index === args.length)
        throw new ConfigurationError(`Option '${opt}' expects an argument.`);
    return args[index];
}

function trimSingleQuotes(str: string) {
    return str.startsWith("'") ? str.slice(1, -1) : str;
}

function assertNever(_: never, message: string): never {
    throw new ConfigurationError(message);
}
