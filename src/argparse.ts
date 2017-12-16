import { Command, CommandName, LintCommand, TestCommand, ShowCommand, InitCommand, VerifyCommand, Format } from './runner';
import { ConfigurationError } from './error';

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
        case CommandName.Verify:
            return parseVerifyCommand(args.slice(1));
        default:
            return parseLintCommand(<AssertNever<typeof command>>args);
    }
}

type AssertNever<T extends never> = T;

function parseLintCommand(args: string[]): LintCommand {
    const result: LintCommand = {
        command: CommandName.Lint,
        config: undefined,
        files: [],
        exclude: [],
        project: undefined,
        format: undefined,
        fix: false,
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
            case '--':
                result.files.push(...args.slice(i + 1));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                result.files.push(arg);
        }
    }

    return result;
}

function parseTestCommand(args: string[]): TestCommand {
    const result: TestCommand = {
        command: CommandName.Test,
        files: [],
        updateBaselines: false,
    };

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-u':
            case '--update':
                ({index: i, argument: result.updateBaselines} = parseOptionalBoolean(args, i));
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
    let format: Format | undefined;

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-f':
            case '--format':
                format = expectFormatArgument(args, ++i, arg);
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
        directories: [],
        format: undefined,
        root: undefined,
    };

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-f':
            case '--format':
                result.format = expectFormatArgument(args, ++i, arg);
                break;
            case '-r':
            case '--root':
                ({index: i, argument: result.root} = parseOptionalBoolean(args, i));
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

function parseVerifyCommand(args: string[]): VerifyCommand {
    const result: VerifyCommand = {
        command: CommandName.Verify,
        files: [],
    };

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '--':
                result.files.push(...args.slice(i + 1));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new ConfigurationError(`Unknown option '${arg}'.`);
                result.files.push(arg);
        }
    }

    return result;
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
