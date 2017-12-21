import { AbstractFormatter, FormatterConstructor } from './types';
import { resolveExecutable } from './utils';

export function loadFormatter(name: string, basedir?: string): AbstractFormatter {
    let formatter: FormatterConstructor | undefined;
    if (/^[a-zA-Z]+$/.test(name))
        formatter = loadCoreFormatter(name);
    if (formatter === undefined)
        formatter = loadCustomFormatter(name, basedir);
    return new formatter();
}

function loadCoreFormatter(name: string): FormatterConstructor | undefined {
    let filename: string;
    try {
        filename = require.resolve(`./formatters/${name}`);
    } catch {
        return;
    }
    return require(filename).Formatter;
}

function loadCustomFormatter(name: string, basedir = process.cwd()): FormatterConstructor {
    return require(resolveExecutable(name, basedir)).Formatter;
}
