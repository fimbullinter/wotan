export {};
declare function take<T>(arg: T): void;
declare function get<T>(): T;

take<() => void>(async () => {});
take<() => Promise<void>>(async () => {});
take<() => () => void>(() => async () => {});
take<() => void>(() => Promise.resolve());
take<() => void>(Promise.resolve);
take<() => void>(get<() => PromiseLike<void>>());
take<() => void>(get<() => Promise<void> | void>());
take(async () => {});
take<any>(async () => {});
take<() => any>(async () => {});

take<(() => void) | undefined>(async () => {});
take<(() => void) | undefined>(get<(() => Promise<void>) | undefined>());

take<() => void>(async function foo() {});
take<() => void>(function foo() { return Promise.resolve(); });
take<() => void>(function() { return Promise.resolve(); });

[1, 2, 3].forEach(async (v) => Promise.resolve(v));

const foo = {async foo() {}};
take({async foo() {}});
take<{foo?: () => void}>({async foo() {}});
take<{foo: () => void}>({foo() { return Promise.resolve(); }});
take<{foo: () => void}>({foo() {}});
take<{foo: () => void}>({async [get<'foo'>()]() {}});
take<{[x: string]: () => void}>({async foo() {}, async '1'() {}});
take<{[x: string]: () => void; [x: number]: () => PromiseLike<void>}>({async foo() {}, async '1'() {}});

const name = 'foo';
take<{foo: () => void}>({async [name]() {}});
take<{[x: string]: (() => void) | undefined; bar?: () => Promise<void>}>({async [get<'foo' | 'bar'>()]() {}});
take<{[x: string]: (() => void) | undefined}>({async [get<'foo' | 'bar'>()]() {}});
take<{[x: string]: (() => Promise<void>) | undefined}>({async [get<'foo' | 'bar'>()]() {}});

declare class C<T> {
    foo(): T;
    bar(): Promise<T>;

    overloaded(): void;
}

declare interface I<T> {
    baz(): T;
    bas(): void;
}

class D extends C<void> implements I<void> {
    async foo() {}
    baz = async () => {};
    bas() {}
}

const otherName = 'overloaded';
(class extends C<void> {
    async [name]() {}
    [otherName](): void;
    [otherName](foo?: boolean): Promise<void>;
    async [otherName]() {}
});

(class extends C<void> {
    [name]: () => Promise<void>;
    [otherName]: () => void;
});

(class extends C<void> implements I<void>{
    async foo() {}
    async bar() {}
    baz() {
        return Promise.resolve();
    }
    async [get<'bas'>()]() {}
    async bas() {}

    async overloaded(): Promise<void>;
    async overloaded(param: string): Promise<void>;
    async overloaded() {
        return;
    }
});

(class implements C<void> {
    async foo() {}
    async bar() {}
    async baz() {}
    overloaded(): void;
    overloaded(foo?: boolean): Promise<void>;
    async overloaded(foo?: boolean) {}
});

(class implements I<void> {
    async foo() {}
    async bar() {}
    async baz() {}
    bas() {}
});
