import { Command, CommandName, LintCommand, TestCommand, ShowCommand, InitCommand, ValidateCommand } from './commands';
import { ConfigurationError } from './error';
import { Format } from './types';

export function parseArguments(args: string[]): Command {
    args = args.map(trimSingleQuotes);

    const command = <CommandName>args[0];
    switch (command) {
        case CommandName.Lint:
            return parseLintCommand(args.slice(1));
        case CommandName.Init:
            return parseInitCommand(args.slice(1));
        case CommandName.Test:
            return parseTestCommand(args.slice(1));
        case CommandName.Show:
            return parseShowCommand(args.slice(1));
        case CommandName.Validate:
            return parseValidateCommand(args.slice(1));
        default:
            return parseLintCommand(<AssertNever<typeof command>>args); // wotan-disable-line no-useless-assertion
    }
}

type AssertNever<T extends never> = T;

function parseLintCommand(args: string[]): LintCommand {
    const result: LintCommand = {
        command: CommandName.Lint,
        modules: [],
        config: undefined,
        files: [],
        exclude: [],
        project: undefined,
        format: undefined,
        fix: false,
        extensions: undefined,
    };

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-p':
            case '--project':
                result.project = expectStringArgument(args, ++i, arg);
                break;
            case '-e':
            case '--exclude':
                result.exclude.push(expectStringArgument(args, ++i, arg));
                break;
            case '-f':
            case '--format':
                result.format = expectStringArgument(args, ++i, arg);
                break;
            case '-c':
            case '--config':
                result.config = expectStringArgument(args, ++i, arg);
                break;
            case '--fix':
                ({index: i, argument: result.fix} = parseOptionalBooleanOrNumber(args, i));
                break;
            case '--ext': {
                const extensions = expectStringArgument(args, ++i, arg).split(/,/g).map(sanitizeExtensionArgument);
                if (result.extensions === undefined) {
                    result.extensions = extensions;
                } else {
                    result.extensions.push(...extensions);
                }
                break;
            }
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

function parseShowCommand(args: string[]): ShowCommand {
    const files = [];
    const modules = [];
    let format: Format | undefined;

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-f':
            case '--format':
                format = expectFormatArgument(args, ++i, arg);
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
                modules,
                command: CommandName.Show,
                file: files[0],
            };
        default:
            throw new ConfigurationError('more than one filename provided');
    }
}

function parseInitCommand(args: string[]): InitCommand {
    const result: InitCommand = {
        command: CommandName.Init,
        modules: [],
        directories: [],
        format: undefined,
    };

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-f':
            case '--format':
                result.format = expectFormatArgument(args, ++i, arg);
                break;
            case '-m':
            case '--module':
                result.modules.push(...expectStringArgument(args, ++i, arg).split(/,/g));
                break;
            case '--':
                result.directories.push(...args.slice(i + 1));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                result.directories.push(arg);
        }
    }

    return result;
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
