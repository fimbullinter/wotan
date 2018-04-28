export namespace foo {
    declare module bar {}
}
export module foo {
    namespace nested.sub {
        module event.more.nesting {}
    }
}

module namespace {
    namespace module {}
}

declare module 'foo' {
    namespace ns {
        module nested {}
    }
}
declare module 'bar';

declare global {}

let module = '';
