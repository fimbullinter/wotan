import { Failure } from './linter';
import * as resolve from 'resolve';

export interface Formatter {
    format(failures: Failure[], fixed: number): string;
}

interface FormatterConstructor {
    new(): Formatter;
}

export function loadFormatter(name: string): Formatter {
    let formatter: FormatterConstructor | undefined;
    if (/^[a-zA-Z]+$/.test(name))
        formatter = loadCoreFormatter(name);
    if (formatter === undefined)
        formatter = loadCustomFormatter(name);
    if (formatter === undefined)
        throw new Error(`Cannot find Formatter '${name}'`);
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

function loadCustomFormatter(name: string): FormatterConstructor | undefined {
    let filename: string;
    try {
        filename = resolve.sync(name, {
            basedir: process.cwd(),
            extensions: Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
        });
    } catch {
        return;
    }
    return require(filename).Formatter;
}
