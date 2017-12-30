import { Format } from './types';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';
import * as resolve from 'resolve';
import { ConfigurationError } from './error';
import * as fs from 'fs';
import * as glob from 'glob';
import * as ts from 'typescript';

// @internal
/**
 * Number of .. until the containing node_modules.
 * __dirname -> src
 * ..        -> project root
 * ../..     -> node_modules (or @scope)
 * ../../..  -> node_modules if @scoped package
 */
export const OFFSET_TO_NODE_MODULES = 2; // add 1 if published as scoped module

export function isStrictNullChecksEnabled(options: ts.CompilerOptions): boolean {
    return options.strict ? options.strictNullChecks !== false : options.strictNullChecks === true;
}

export const memoizeGetter: MethodDecorator = (_target, property, descriptor) => {
    if (descriptor.get === undefined)
        throw new Error('@memoizeGetter can only be used with get accessors');
    const originalGetter = descriptor.get;
    descriptor.get = function() {
        const value = originalGetter.call(this);
        Object.defineProperty(this, property, {value, writable: false});
        return value;
    };
};

export function arrayify<T>(maybeArr: T | T[] | undefined): T[] {
    return Array.isArray(maybeArr)
        ? maybeArr
        : maybeArr === undefined
            ? []
            : [maybeArr];
}

export function memoize<T, U>(fn: (arg: T) => U): (arg: T) => U {
    const cache = new Map<T, U>();
    return (arg: T): U => {
        let cached = cache.get(arg);
        if (cached === undefined && !cache.has(arg)) {
            cached = fn(arg);
            cache.set(arg, cached);
        }
        return cached!;
    };
}

export function unixifyPath(path: string): string {
    return path.replace(/\\/g, '/');
}

export function format<T = any>(value: T, fmt = Format.Yaml): string {
    value = convertToPrintable(value);
    switch (fmt) {
        case Format.Json:
            return JSON.stringify(value, undefined, 2);
        case Format.Json5:
            return json5.stringify(value, undefined, 2);
        case Format.Yaml:
            return yaml.safeDump(value, {
                indent: 2,
                schema: yaml.JSON_SCHEMA,
                sortKeys: true,
            });
        default:
            return assertNever(fmt);
    }
}

function convertToPrintable(value: any): any {
    if (value == undefined || typeof value !== 'object')
        return value;
    if (value instanceof Map) {
        const obj: {[key: string]: any} = {};
        for (const [k, v] of value)
            if (v !== undefined)
                obj[k] = v;
        value = obj;
    }
    if (Array.isArray(value)) {
        const result = [];
        for (const element of value) {
            const converted = convertToPrintable(element);
            if (converted !== undefined)
                result.push(converted);
        }
        return result.length === 0 ? undefined : result;
    }
    const keys = Object.keys(value);
    if (keys.length === 0)
        return;
    let added = false;
    const newValue: {[key: string]: any} = {};
    for (const key of keys) {
        const converted = convertToPrintable(value[key]);
        if (converted !== undefined) {
            newValue[key] = converted;
            added = true;
        }
    }
    return added ? newValue : undefined;
}

export function assertNever(v: never): never {
    throw new Error(`unexpected value '${v}'`);
}

export function resolveExecutable(name: string, basedir: string): string {
    try {
        return resolve.sync(name, {
            basedir,
            extensions: Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
            paths: module.paths.slice(OFFSET_TO_NODE_MODULES),
        });
    } catch (e) {
        throw new ConfigurationError(e.message);
    }
}

export function writeFile(path: string, content: string): Promise<void> {
    return new Promise((res, rej) => {
        return fs.writeFile(path, content, 'utf8', (err) => err ? rej(err) : res());
    });
}

export function readFile(path: string): Promise<string> {
    return new Promise((res, rej) => {
        return fs.readFile(path, 'utf8', (err, data) => err ? rej(err) : res(data));
    });
}

export function unlinkFile(path: string): Promise<void> {
    return new Promise((res, rej) => {
        return fs.unlink(path, (err) => err ? rej(err) : res());
    });
}

export function globAsync(pattern: string, options: glob.IOptions): Promise<string[]> {
    return new Promise((res, rej) => {
        return glob(pattern, options, (err, matches) => err ? rej(err) : res(matches));
    });
}

export function calculateChangeRange(original: string, changed: string): ts.TextChangeRange {
    const diff = changed.length - original.length;
    let start = 0;
    let end = original.length;
    const minEnd = diff >= 0 ? end : changed.length;
    for (; start < minEnd && original[start] === changed[start]; ++start)
        ;
    if (start !== minEnd) {
        const maxStart = end - minEnd + start;
        // tslint:disable-next-line:ban-comma-operator
        for (let changedEnd = changed.length; maxStart < end && original[end - 1] === changed[changedEnd - 1]; --end, --changedEnd)
            ;
    }

    const length = end - start;
    return {
        span: {
            start,
            length,
        },
        newLength: length + diff,
    };
}
