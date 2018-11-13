import { Format, Cache } from '@fimbul/ymir';
import * as json5 from 'json5';
import * as yaml from 'js-yaml';
import * as ts from 'typescript';
import * as path from 'path';

// @internal
/**
 * Number of .. until the containing node_modules.
 * __dirname -> src
 * ..        -> project root
 * ../..     -> node_modules (or @scope)
 * ../../..  -> node_modules if @scoped package
 */
export const OFFSET_TO_NODE_MODULES = 3;

export function arrayify<T>(maybeArr: T | ReadonlyArray<T> | undefined): ReadonlyArray<T> {
    return Array.isArray(maybeArr)
        ? maybeArr
        : maybeArr === undefined
            ? []
            : [maybeArr];
}

export function resolveCachedResult<K, V>(cache: Cache<K, V>, key: K, cb: (key: K) => V): V {
    let result = cache.get(key);
    if (result === undefined && !cache.has(key)) {
        result = cb(key);
        cache.set(key, result);
    }
    return result!;
}

export function unixifyPath(p: string): string {
    return p.replace(/\\/g, '/');
}

export function format<T = any>(value: T, fmt = Format.Yaml): string {
    value = convertToPrintable(value) || {};
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
        const result = mapDefined(value, convertToPrintable);
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

export function hasSupportedExtension(fileName: string, extensions?: ReadonlyArray<string>) {
    const ext = path.extname(fileName);
    return /^\.[jt]sx?$/.test(ext) || extensions !== undefined && extensions.includes(ext);
}

export function mapDefined<T, U>(input: Iterable<T>, cb: (item: T) => U | undefined) {
    const result = [];
    for (const item of input) {
        const current = cb(item);
        if (current !== undefined)
            result.push(current);
    }
    return result;
}

export function flatMap<T, U>(input: Iterable<T>, cb: (item: T) => Iterable<U>) {
    const result = [];
    for (const item of input)
        result.push(...cb(item));
    return result;
}

/**
 * Adds an item to an array if it's not already included.
 * @returns true if the item was not present in the array
 * */
export function addUnique<T>(arr: T[], item: T & {[K in keyof T]: T[K]}) {
    if (arr.includes(item))
        return false;
    arr.push(item);
    return true;
}
