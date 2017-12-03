import { Command, CommandKind, LintCommand, TestCommand, ShowCommand, InitCommand, VerifyCommand, Format } from './runner';

export function parseArguments(args: string[]): Command {
    args = args.map(trimSingleQuotes);

    if (args.length === 0)
        throw new Error('expected subcommand');

    const command = <CommandKind>args[0];
    args = args.slice(1);
    switch (command) {
        case CommandKind.Lint:
            return parseLintCommand(args);
        case CommandKind.Init:
            return parseInitCommand(args);
        case CommandKind.Test:
            return parseTestCommand(args);
        case CommandKind.Show:
            return parseShowCommand(args);
        case CommandKind.Verify:
            return parseVerifyCommand(args);
        default:
            return assertNever(command, `Invalid subcommand '${command}'`);
    }
}

function parseLintCommand(args: string[]): LintCommand {
    const result: LintCommand = {
        command: CommandKind.Lint,
        files: [],
        exclude: [],
        project: undefined,
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
            case '--':
                result.files.push(...args.slice(i + 1));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new Error(`Unknown option '${arg}'.`);
                result.files.push(arg);
        }
    }

    return result;
}

function parseTestCommand(args: string[]): TestCommand {
    const result: TestCommand = {
        command: CommandKind.Test,
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
                    throw new Error(`Unknown option '${arg}'.`);
                result.files.push(arg);
        }
    }

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
                    throw new Error(`Unknown option '${arg}'.`);
                files.push(arg);
        }
    }
    switch (files.length) {
        case 0:
            throw new Error('filename expected');
        case 1:
            return {
                format,
                command: CommandKind.Show,
                file: files[0],
            };
        default:
            throw new Error('more than one filename provided');
    }
}

function parseInitCommand(args: string[]): InitCommand {
    const result: InitCommand = {
        command: CommandKind.Init,
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
                    throw new Error(`Unknown option '${arg}'.`);
                result.directories.push(arg);
        }
    }

    return result;
}

function parseVerifyCommand(args: string[]): VerifyCommand {
    const result: VerifyCommand = {
        command: CommandKind.Verify,
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
                    throw new Error(`Unknown option '${arg}'.`);
                result.files.push(arg);
        }
    }

    return result;
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
        throw new Error(`Option '${opt}' expects an argument.`);
    return args[index];
}

function trimSingleQuotes(str: string) {
    return str.startsWith("'") ? str.slice(1, -1) : str;
}

function assertNever(_: never, message: string): never {
    throw new Error(message);
}
