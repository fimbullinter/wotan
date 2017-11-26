import { RunnerOptions } from './runner';

export function parseArguments(args: string[]): RunnerOptions {
    const result: RunnerOptions = {
        files: [],
        exclude: [],
        project: undefined,
    };

    outer: for (let i = 0; i < args.length; ++i) {
        const arg = trimSingleQuotes(args[i]);
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
                result.files.push(...args.slice(i + 1).map(trimSingleQuotes));
                break outer;
            default:
                if (arg.startsWith('-'))
                    throw new Error(`Unknown option '${arg}'.`);
                result.files.push(arg);
        }
    }

    return result;
}

function expectStringArgument(args: string[], index: number, opt: string): string {
    if (index === args.length)
        throw new Error(`Option '${opt}' expects an argument.`);
    return trimSingleQuotes(args[index]);
}

function trimSingleQuotes(str: string) {
    return str.startsWith("'") ? str.slice(1, -1) : str;
}
