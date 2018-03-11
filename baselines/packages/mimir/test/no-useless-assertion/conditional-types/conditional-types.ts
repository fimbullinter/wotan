export {};

type Nullable<T> = T extends null | undefined ? T : T | null | undefined;
type NonNullable<T> = T extends null | undefined ? never : T;

declare function nullable<T>(param: T): Nullable<T>;
declare function nonNullable<T>(param: T): NonNullable<T>;

declare function takeString(param: string): void;
declare function takeNullable(param: Nullable<string>): void;

declare let v: Nullable<string>;
declare let s: NonNullable<typeof v>;

takeString(v!);
takeNullable(v);
takeString(s);
takeNullable(s);
takeNullable(nullable(s));
takeString(nonNullable(v));

nullable(s)!;
nonNullable(s);
nullable(null)!;
nonNullable(null);

nullable(s) as string;
nullable(s);
nonNullable(s);

v as NonNullable<typeof s>;
s as Nullable<string>;
s;
(Boolean() ? s : null) as NonNullable<string>;
