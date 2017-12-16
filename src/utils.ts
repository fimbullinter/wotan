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
