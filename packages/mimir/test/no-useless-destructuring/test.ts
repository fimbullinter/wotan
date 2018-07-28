declare var v: any;
declare function get<T>(): T;

let {} = {};
({} = {});
({prop: {}} = {prop: {}});
({...{}} = {});

let [] = [];
[] = [];
[{}, [, {nested: {}}], (v)] = [{}, [{nested: {}}, {nested: {}}], 1];
[, , , ...[, [], ...[]]] = new Array(10);
[v, , , [], {}, ] = new Array(10);

function obj({}: Record<string, string>){}
function arr([, , , ]: any[]){}

({...{v}} = get<Record<string, any>>());

({v, prop: [],} = get<any>());
({v, prop: []} = get<any>());
({prop: [], v} = get<any>());

({v, ...{v}} = get<Record<string, any>>());

[...[v]] = [1];
[v, ...[, [], ]] = [1, [], []];

function foo(...[...[a]]: any[]) {}
