// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
// type IsTuple<T> = T extends readonly any[]
//   ? number extends T["length"]
//     ? false
//     : true
//   : false;

// My solution will fail the testcase Expect<Equal<IsTuple<[number, ...string[]]>, true>>

// type IsTuple<T> = [T] extends [readonly any[]]
//   ? number extends T["length"]
//     ? false
//     : true
//   : false;

// The above solution despite turning off distribution will also fail the testcase Expect<Equal<IsTuple<[number, ...string[]]>, true>>

// Notka: Pamiętać o zastosowaniu odpowiedniego indentingu wtedy jest bardziej jasne co pasuje do czego

// type IsTuple<T> = T extends readonly any[]
//   ? T extends readonly [any, ...infer Rest]
//     ? Rest["length"] extends T["length"] // Tu chodzi o ten trik z odejmowaniem 1 od nieskonczonosci bo Infinity - 1 daje Infinity
//       ? false
//       : true
//     : false
//   : false; // not even an array-ish thing

// type IsTuple<T> = T extends readonly any[]
//   ? [...T, any]["length"] extends T["length"] // Jeżeli array T z jednym elementem więcej od samego array T
//     ? // ma taką samą długość jak sam array T
//       // to oznacza że mamy do czynienia z Infinity
//       // zatem array nie ma finite length więc nie uznajemy go za Tuple
//       false
//     : true
//   : false; // not even an array-ish thing

// The above type will fail the testcase Expect<Equal<IsTuple<[number, ...string[]]>, true>>,

// Solution suggested from master.dev:

type IsTuple<T> = [T] extends [never]
  ? false
  : T extends readonly []
    ? true
    : T extends readonly [infer _Head, ...infer _Tail]
      ? true
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
  Expect<Equal<IsTuple<[number, ...string[]]>, true>>,
];

export {};
