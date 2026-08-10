// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
type ReturnOf<F extends (...args: any[]) => any> = F extends (
  ...args: any[]
) => infer R
  ? R
  : never;

// here should be void
type p = ReturnOf<(typeof Promise)["resolve"]>;

// type Test1 = (() => void) extends (...args: any[]) => {} ? true : false;
// type Test2 = (() => void) extends (...args: any[]) => any ? true : false;

// type Z = number extends {} ? true : false;
// type X = string extends {} ? true : false;
// type P = boolean extends {} ? true : false;
// type D = null extends {} ? true : false;
// type E = undefined extends {} ? true : false;
// type G = void extends {} ? true : false;

type ReturnsOfAll<T extends Record<string, (...args: any[]) => any>> = {
  [K in keyof T]: ReturnOf<T[K]>;
};

type API = {
  getUser: () => { id: number };
  getPosts: () => string[];
};

type R = ReturnsOfAll<API>;

type A = (() => void) extends () => {} ? true : false;
type B = (() => undefined) extends () => {} ? true : false;
type C = (() => null) extends () => {} ? true : false;

// const p: ReturnType<(typeof Promise)["resolve"]>;

// Tests

const flipCoin = () => (Math.random() > 0.5 ? "heads" : "tails");
const rockPaperScissors = (arg: 1 | 2 | 3) => {
  return arg === 1
    ? ("rock" as const)
    : arg === 2
      ? ("paper" as const)
      : ("scissors" as const);
};

type cases = [
  // simple 1
  Expect<Equal<boolean, ReturnOf<() => boolean>>>,
  // simple 2
  Expect<Equal<123, ReturnOf<() => 123>>>,
  Expect<Equal<ComplexObject, ReturnOf<() => ComplexObject>>>,
  Expect<Equal<Promise<boolean>, ReturnOf<() => Promise<boolean>>>>,
  Expect<Equal<() => "foo", ReturnOf<() => () => "foo">>>,
  Expect<Equal<"heads" | "tails", ReturnOf<typeof flipCoin>>>,
  Expect<
    Equal<"rock" | "paper" | "scissors", ReturnOf<typeof rockPaperScissors>>
  >,
];

type ComplexObject = {
  a: [12, "foo"];
  bar: "hello";
  prev(): number;
};
