// https://github.com/DefinitelyTyped/DefinitelyTyped/pull/23576
declare module 'npm-packlist' {
    function packlist(options?: packlist.Options): PromiseLike<string[]>
    function packlist<T>(options: packlist.Options | undefined, callback: (result: string[]) => T): PromiseLike<T>
    namespace packlist {
        interface Options {
            /** Directory to walk recusively. Defaults to `process.cwd()`. */
            path?: string;
        }
        function sync(options?: Options): string[];
    }
    export = packlist;
}
