// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
type IsTuple<T> = T extends readonly any[]
  ? number extends T["length"]
    ? false
    : true
  : false;

let x: IsTuple<number[]>;
let y: []["length"];
let z: number[]["length"];

type U = IsTuple<[1] | number[]>; // boolean, nie false
type V = IsTuple<any>; // boolean
type W = IsTuple<never>; // never

type Distributive<T> = T extends string ? "tak" : "nie";
type R1 = Distributive<string | number>; // "tak" | "nie"

// Tests
type cases = [
  Expect<Equal<IsTuple<[]>, true>>,
  Expect<Equal<IsTuple<[number]>, true>>,
  Expect<Equal<IsTuple<readonly [1]>, true>>,
  Expect<Equal<IsTuple<{ length: 1 }>, false>>,
  Expect<Equal<IsTuple<number[]>, false>>,
];

export {};
