import { Command, CommandName, TestCommand, ShowCommand, ValidateCommand, BaseLintCommand } from './commands';
import { ConfigurationError, Format, GlobalOptions, Severity } from '@fimbul/ymir';
import { LintOptions } from './runner';
import debug = require('debug');
import { OptionParser } from './optparse';

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
            command =
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

export const GLOBAL_OPTIONS_SPEC = {
    modules: OptionParser.Transform.withDefault(OptionParser.Factory.parsePrimitiveOrArray('string'), []),
    config: OptionParser.Factory.parsePrimitive('string'),
    files: OptionParser.Transform.withDefault(OptionParser.Factory.parsePrimitiveOrArray('string'), []),
    exclude: OptionParser.Transform.withDefault(OptionParser.Factory.parsePrimitiveOrArray('string'), []),
    project: OptionParser.Transform.withDefault(OptionParser.Factory.parsePrimitiveOrArray('string'), []),
    references: OptionParser.Transform.withDefault(OptionParser.Factory.parsePrimitive('boolean'), false),
    formatter: OptionParser.Factory.parsePrimitive('string'),
    fix: OptionParser.Transform.withDefault(OptionParser.Factory.parsePrimitive('boolean', 'number'), false),
    extensions: OptionParser.Transform.map(OptionParser.Factory.parsePrimitiveOrArray('string'), sanitizeExtensionArgument),
    reportUselessDirectives: OptionParser.Transform.transform(
        OptionParser.Factory.parsePrimitive('string', 'boolean'),
        (value): Severity | boolean => {
            switch (value) {
                case true:
                case false:
                case 'error':
                case 'warning':
                case 'suggestion':
                    return value;
                case 'warn':
                    return 'warning';
                case 'hint':
                    return 'suggestion';
                case undefined:
                    return false;
                default:
                    return 'error';
            }
        },
    ),
};

export function parseGlobalOptions(options: GlobalOptions | undefined): ParsedGlobalOptions {
    return OptionParser.parse(options, GLOBAL_OPTIONS_SPEC, {context: 'global options'});
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
    const projects: string[] = [];

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = args[i];
        switch (arg) {
            case '-p':
            case '--project':
                result.project = projects;
                const project = expectStringArgument(args, ++i, arg);
                if (project !== '')
                    projects.push(project);
                break;
            case '-r':
            case '--references':
                ({index: i, argument: result.references} = parseOptionalBoolean(args, i));
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
            case '--report-useless-directives':
                ({index: i, argument: result.reportUselessDirectives} = parseOptionalSeverityOrBoolean(args, i));
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
        } else if (result.project.length !== 0 || result.files.length === 0) {
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

function parseOptionalSeverityOrBoolean(args: string[], index: number): {index: number, argument: Severity | boolean} {
    if (index + 1 !== args.length) {
        switch (args[index + 1]) {
            case 'true':
                return {index: index + 1, argument: true};
            case 'false':
                return {index: index + 1, argument: false};
            case 'error':
                return {index: index + 1, argument: 'error'};
            case 'warn':
            case 'warning':
                return {index: index + 1, argument: 'warning'};
            case 'hint':
            case 'suggestion':
                return {index: index + 1, argument: 'suggestion'};
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
