import { Format } from './types';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';
import * as resolve from 'resolve';
import { ConfigurationError } from './error';

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

export function resolveExecutable(name: string, basedir: string, paths?: string[]): string {
    try {
        return resolve.sync(name, {
            basedir,
            paths,
            extensions: Object.keys(require.extensions).filter((ext) => ext !== '.json' && ext !== '.node'),
        });
    } catch (e) {
        throw new ConfigurationError(e.message);
    }
}
