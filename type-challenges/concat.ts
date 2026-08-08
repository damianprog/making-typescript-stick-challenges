// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
type Concat<A extends any[], B extends any[]> = [...A, ...B];

// Tests
type cases = [
  Expect<Equal<Concat<[], []>, []>>,
  Expect<Equal<Concat<[], ["hello"]>, ["hello"]>>,
  Expect<Equal<Concat<[18, 19], [20, 21]>, [18, 19, 20, 21]>>,
  Expect<
    Equal<
      Concat<[42, "a", "b"], [Promise<boolean>]>,
      [42, "a", "b", Promise<boolean>]
    >
  >,
];
