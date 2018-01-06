declare function get<T>(): T;

function notAsync() {
    return get<Promise<string>>();
    try {
        return get<PromiseLike<string>>();
    } catch {
        return get<PromiseLike<string>>();
    } finally {
        return get<PromiseLike<string>>();
    }
}
