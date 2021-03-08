export {};

[...[]];
[...[1]];
[...new Set()];
[...new Map()];

declare function doStuff(...args: any[]): void;
doStuff(...[]);

declare const arrayLike: ArrayLike<number>;
({...arrayLike});
let {...a} = [];
({...a} = []);
let b: Array<number>;
({...b} = [1]);

({...[]});
({...[1]});
({...new Set()});
({...new Map()});

({a: 1, ...[1] as const});
({..."..."});

<span {...new Map()}></span>;
