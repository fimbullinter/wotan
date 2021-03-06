export {};
declare function get<T>(): T;

get<{prop: string}>()?.prop!;
get<{prop?: string}>()?.prop!;
get<undefined | {prop: string}>()?.prop!;
get<undefined | {prop: string}>()?.prop!.charAt(0);
get<undefined | {prop: string | null}>()?.prop!.charAt(0);
get<undefined | {prop: string | undefined}>()?.prop!.charAt(0);
