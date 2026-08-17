// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
type Split<S extends string, SEP extends string> = string extends S
  ? string[]
  : S extends ""
    ? SEP extends ""
      ? []
      : [""]
    : S extends `${infer frag}${SEP}${infer rest}`
      ? [frag, ...Split<rest, SEP>]
      : [S];

// Tests

type test = string extends `${infer a}whatever${infer b}` ? true : false;

type Probe = Split<"abc", "">;
type Probe2 = Split<"ab", "">;

type A = "abc" extends "" ? true : false;
type B = "" extends "" ? true : false;

type cases = [
  Expect<Equal<Split<"Hi! How are you?", "z">, ["Hi! How are you?"]>>,
  Expect<Equal<Split<"Hi! How are you?", " ">, ["Hi!", "How", "are", "you?"]>>,
  Expect<
    Equal<
      Split<"Hi! How are you?", "">,
      [
        "H",
        "i",
        "!",
        " ",
        "H",
        "o",
        "w",
        " ",
        "a",
        "r",
        "e",
        " ",
        "y",
        "o",
        "u",
        "?",
      ]
    >
  >,
  Expect<Equal<Split<"", "">, []>>,
  Expect<Equal<Split<"", "z">, [""]>>,
  Expect<Equal<Split<string, "whatever">, string[]>>,
];
