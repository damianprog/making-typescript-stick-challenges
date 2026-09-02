// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
// type IndexOf<T, U> = T extends [
//     ...infer head, infer tail
// ] ? tail extends U ? head["length"] : IndexOf<head, U>

// [1, 2, 3]
//    F = 1     Rest = [2, 3]
//      IndexOf<[2, 3], 2, [1]>
//      IndexOf<[3], 2, [1, 2]>

// type IndexOf<T extends any[], U, Acc extends any[] = []> = T extends [
//   infer F,
//   ...infer Rest,
// ]
//   ? IndexOf<Rest, U, [...Acc, F]>
//   : never;

// let x: IndexOf<[1, 2, 3], 2>;

type IndexOf<T extends any[], U, Acc extends any[] = []> = T[0] extends U
  ? Acc["length"]
  : T extends [infer F, ...infer Rest]
    ? IndexOf<Rest, U, [...Acc, F]>
    : -1;

let x: IndexOf<[1, 2, 3], 2>;

// Tests

type cases = [
  Expect<Equal<IndexOf<[1, 2, 3], 2>, 1>>,
  Expect<Equal<IndexOf<[2, 6, 3, 8, 4, 1, 7, 3, 9], 3>, 2>>,
  Expect<Equal<IndexOf<[0, 0, 0], 2>, -1>>,
];
