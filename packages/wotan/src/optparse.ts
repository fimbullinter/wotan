import debug = require('debug');
import { ConfigurationError } from '@fimbul/ymir';
const log = debug('wotan:optparse');

export namespace OptionParser {
    export type MismatchCallback = (type: string) => void;

    export type ParseFunction<T> = (value: any, report: MismatchCallback) => T;

    export type ParsedOptions<T extends Record<string, ParseFunction<any>>> = {
        [K in keyof T]: ReturnType<T[K]>
    };

    export interface ParseConfig {
        validate?: boolean;
        context?: string;
    }

    export function parse<T extends Record<string, ParseFunction<any>>>(
        options: Record<string, any> | undefined,
        specs: T,
        config: ParseConfig,
    ): ParsedOptions<T> {
        const result: Record<string, any> = {};
        let name: string;
        for (name of Object.keys(specs))
            result[name] = specs[name](options && options[name], reportMismatch);
        return <ParsedOptions<T>>result;

        function reportMismatch(type: string) {
            const message = `${config.context ? config.context + ': ' : ''}Expected a value of type '${type}' for option '${name}'.`;
            if (config.validate)
                throw new ConfigurationError(message);
            log(message);
        }
    }

    export function withDefault<T>(parseFn: ParseFunction<T | undefined>, defaultValue: T): ParseFunction<T> {
        return (value, report) => {
            const result = parseFn(value, report);
            return result === undefined ? defaultValue : result;
        };
    }

    export function map<T extends U[] | undefined, U, V>(
        parseFn: ParseFunction<T>,
        cb: (item: U) => V,
    ): ParseFunction<{[K in keyof T]: V}> {
        return (value, report) => {
            const result = parseFn(value, report);
            return <any>(result === undefined ? undefined : result.map(cb));
        };
    }

    export namespace Parser {
        type PrimitiveName = 'string' | 'number' | 'boolean';
        type PrimitiveMap<T extends PrimitiveName> =
            T extends 'string'
                ? string
                : T extends 'number'
                    ? number
                    : boolean;

        export function parsePrimitive<T extends PrimitiveName[]>(...types: T): ParseFunction<PrimitiveMap<T[number]> | undefined> {
            return (value, report) => {
                for (const type of types)
                    if (typeof value === type)
                        return value;
                if (value !== undefined)
                    report(types.join(' | '));
                return;
            };
        }

        export function parsePrimitiveOrArray<T extends PrimitiveName>(type: T): ParseFunction<Array<PrimitiveMap<T>> | undefined> {
            return (value, report) => {
                if (Array.isArray(value) && value.every((v) => typeof v === type))
                    return value;
                if (typeof value === 'string')
                    return [value];
                if (value !== undefined)
                    report('string | string[]');
                return;
            };
        }
    }
}
