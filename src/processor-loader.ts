import { ProcessorConstructor } from './types';

const CACHE = new Map<string, ProcessorConstructor>();

export function loadProcessor(path: string): ProcessorConstructor {
    let result = CACHE.get(path);
    if (result === undefined) {
        result = <ProcessorConstructor>require(path).Processor;
        CACHE.set(path, result);
    }
    return result;
}
