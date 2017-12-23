declare module 'to-absolute-glob' {
    function resolve(pattern: string, options?: resolve.Options): string;
    namespace resolve {
        export interface Options {
            cwd?: string;
            root?: string;
        }
    }
    export = resolve;
}
