import { Command, CommandName, LintCommand, TestCommand, ShowCommand, ValidateCommand } from './commands';
import { ConfigurationError } from './error';
import { Format, GlobalOptions } from './types';
import { LintOptions } from './runner';

export function parseArguments(args: string[], globalOptions?: GlobalOptions): Command {
    args = args.map(trimSingleQuotes);
    const command = <CommandName>args[0];
    switch (command) {
        case CommandName.Lint:
            return parseLintCommand(args.slice(1), parseGlobalOptions(globalOptions));
        case CommandName.Test:
            return parseTestCommand(args.slice(1));
        case CommandName.Show:
            return parseShowCommand(args.slice(1), parseGlobalOptions(globalOptions));
        case CommandName.Validate:
            return parseValidateCommand(args.slice(1));
        default:
            // wotan-disable-next-line no-useless-assertion
            return parseLintCommand(<AssertNever<typeof command>>args, parseGlobalOptions(globalOptions));
    }
}

export interface ParsedGlobalOptions extends Partial<LintOptions> {
    modules?: string[];
    formatter?: string;
}

export function parseGlobalOptions(options: GlobalOptions | undefined): ParsedGlobalOptions {
    const result: ParsedGlobalOptions = {};
    if (options === undefined)
        return result;
    if (options.fix !== undefined) {
        if (typeof options.fix !== 'number' && typeof options.fix !== 'boolean')
            throw new ConfigurationError("Expected a value of type 'boolean | number' for option 'fix'.");
        result.fix = options.fix;
    }
    if (options.project !== undefined)
        result.project = expectStringOption(options.project, 'project');
    if (options.formatter !== undefined)
        result.formatter = expectStringOption(options.formatter, 'formatter');
    if (options.modules !== undefined)
        result.modules = expectStringOrStringArray(options.modules, 'modules');
    if (options.files !== undefined)
        result.files = expectStringOrStringArray(options.files, 'files');
    if (options.exclude !== undefined)
        result.exclude = expectStringOrStringArray(options.exclude, 'exclude');
    if (options.extensions !== undefined)
        result.extensions = expectStringOrStringArray(options.extensions, 'extensions');

    return result;
}

function expectStringOrStringArray(value: {} | null, option: string): string[] {
    if (Array.isArray(value) && value.every((v) => typeof v === 'string'))
        return value;
    if (typeof value === 'string')
        return [value];
    throw new ConfigurationError(`Expected a value of type 'string | string[]' for option '${option}'`);
}
function expectStringOption(value: {} | null, option: string): string {
    if (typeof value === 'string')
        return value;
    throw new ConfigurationError(`Expected a value of type 'string' for option '${option}'`);
}

type AssertNever<T extends never> = T;

function parseLintCommand(args: string[], defaults: ParsedGlobalOptions): LintCommand {
    const result: LintCommand = {
        command: CommandName.Lint,
        modules: [],
        config: undefined,
        files: [],
        exclude: [],
        project: undefined,
        formatter: undefined,
        fix: false,
        extensions: undefined,
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
                result.project = expectStringArgument(args, ++i, arg);
                break;
            case '-e':
            case '--exclude':
                result.exclude = exclude;
                exclude.push(expectStringArgument(args, ++i, arg));
                break;
            case '-f':
            case '--formatter':
                result.formatter = expectStringArgument(args, ++i, arg);
                break;
            case '-c':
            case '--config':
                result.config = expectStringArgument(args, ++i, arg);
                break;
            case '--fix':
                ({index: i, argument: result.fix} = parseOptionalBooleanOrNumber(args, i));
                break;
            case '--ext': {
                result.extensions = extensions;
                extensions.push(...expectStringArgument(args, ++i, arg).split(/,/g).map(sanitizeExtensionArgument));
                break;
            }
            case '-m':
            case '--module':
                result.modules = modules;
                modules.push(...expectStringArgument(args, ++i, arg).split(/,/g));
                break;
            case '--':
                result.files = files;
                files.push(...args.slice(i + 1));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                result.files = files;
                files.push(arg);
        }
    }

    if (result.extensions !== undefined && (result.project !== undefined || result.files.length === 0))
        throw new ConfigurationError("Options '--ext' and '--project' cannot be used together.");

    return result;
}

function sanitizeExtensionArgument(ext: string): string {
    ext = ext.trim();
    return ext.startsWith('.') ? ext : `.${ext}`;
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
                result.modules.push(...expectStringArgument(args, ++i, arg).split(/,/g));
                break;
            case '--':
                result.files.push(...args.slice(i + 1));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                result.files.push(arg);
        }
    }
    if (result.files.length === 0)
        throw new ConfigurationError('filename expected.');

    return result;
}

function parseShowCommand(args: string[], defaults: ParsedGlobalOptions): ShowCommand {
    const files = [];
    const modules = [];
    let format: Format | undefined;
    let config: string | undefined;

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-f':
            case '--format':
                format = expectFormatArgument(args, ++i, arg);
                break;
            case '-c':
            case '--config':
                config = expectStringArgument(args, ++i, arg);
                break;
            case '-m':
            case '--module':
                modules.push(...expectStringArgument(args, ++i, arg).split(/,/g));
                break;
            case '--':
                files.push(...args.slice(i + 1));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                files.push(arg);
        }
    }
    switch (files.length) {
        case 0:
            throw new ConfigurationError('filename expected');
        case 1:
            return {
                format,
                modules: modules.length === 0 && defaults.modules ? defaults.modules : modules,
                config: config || defaults.config,
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
                if (!isNaN(num))
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
