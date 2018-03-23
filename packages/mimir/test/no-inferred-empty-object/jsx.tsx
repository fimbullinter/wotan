export {};

declare namespace JSX {
    interface IntrinsicElements {
        [elemName: string]: any;
    }

    interface Element {
        render(): Element | string | false;
    }

    interface ElementAttributesProperty<T = any> {
        props: T; // specify the property name to use
    }
}

function SFC<T>(props: Record<string, T>) {
    return '';
}

let foo = <SFC></SFC>;
foo = <SFC/>;
foo = <SFC<string>/>;
foo = <SFC<string>></SFC>;
foo = <SFC<string> prop={1}></SFC>;
foo = <SFC prop="foo"/>;
foo = <SFC prop="foo" other={1}></SFC>;

class MyComponent<T> {
    constructor(private props: Record<string, T>) {}

    render() { return false; }
}

foo = <MyComponent></MyComponent>;
foo = <MyComponent prop="1"></MyComponent>;

function MyFactoryComponent<T>(props: Record<string, T>) {
    return {
        render: () => false,
    };
}

foo = <MyFactoryComponent></MyFactoryComponent>;
foo = <MyFactoryComponent prop="1"></MyFactoryComponent>;
foo = <MyFactoryComponent<string>></MyFactoryComponent>;
