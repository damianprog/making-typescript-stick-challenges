// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
type If<C, T, F> = C extends true ? T : F;

// Tests
type cases = [
  Expect<Equal<If<true, "apple", "pear">, "apple">>,
  Expect<Equal<If<false, "orange", 42>, 42>>,
];
