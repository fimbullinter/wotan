async function testForAwait<T extends AsyncIterable<string>>(param?: T) {
    if (param) {
        for await (const _ of param) {}
    } else {
        for (const _ of param) {}
    }
    for await (const _ of param) {} // don't care to add failure in positions where the compiler already complains
    for await (const _ of get<any>()) {}
    for await (const _ of get<AsyncIterable<string>>()) {}
    for await (const _ of get<string | AsyncIterable<string>>()) {}
    for await (const _ of get<AsyncIterableIterator<string> & {foo: string}>()) {}
    for await (const _ of get<Array<string> | AsyncIterable<string>>()) {}
    for await (const _ of get<{[Symbol.asyncIterator](): any}>()) {}
    for await (const _ of get<{[Symbol.asyncIterator]: any}>()) {}
    for await (const _ of get<{[Symbol.asyncIterator]: string}>()) {}
    for await (const _ of get<{[Symbol.asyncIterator](): AsyncIterator<string>}>()) {}
    for await (const _ of get<{[Symbol.asyncIterator](): {next(): Promise<{value: any, done: boolean}>}}>()) {}
    for await (const _ of get<{[Symbol.asyncIterator](): Iterator<string>}>()) {}
    for await (const _ of get<{[Symbol.asyncIterator](): string}>()) {}
    for (const _ of get<{[Symbol.iterator](): Iterator<string>}>()) {}
    for (const _ of get<Iterable<string>>()) {}
    for (const _ of get<Array<Promise<IteratorResult<string>>>>()) {}
    for (const _ of get<string>()) {}
    for (const _ of get<string | Array<string>>()) {}
    for (const _ of get<AsyncIterator<string>>()) {}
    for (const _ of get<string>()) {}
}
