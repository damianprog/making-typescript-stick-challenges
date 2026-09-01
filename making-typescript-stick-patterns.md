# Making TypeScript — wzorce (patterns)

Notatnik wzorców z challenge'y i realnych problemów. Każdy wpis: co robi, kluczowa idea, kod, pułapki.

---

## Wpis 1: Typed Data Store — generowanie metod z mapy encji

_Źródło: Making TypeScript Stick — Challenge 1 "Building a typed data store"_

### Problem

Mam mapę encji i chcę, żeby klasa store'a **musiała** mieć komplet metod CRUD dla każdej encji
(`getMovie`, `getAllMovies`, `addMovie`, `clearMovies`, `getSong`, …) z poprawnymi sygnaturami.
Cel: **jedno źródło prawdy**. Dopisuję wpis do mapy → kontrakt automatycznie żąda czterech nowych
metod, a klasa się nie kompiluje, dopóki ich nie dostarczę. Literówka w nazwie lub zły typ argumentu = błąd kompilacji.

### Kluczowa idea

Jeden klucz encji → **cztery** metody, a pojedynczy mapped type produkuje **jedną** property na klucz.
Rozwiązanie: cztery osobne mapped typy (po jednej rodzinie metod), połączone **intersekcją `&`**
w jeden kontrakt, wpięty do klasy przez `implements`.

### Użyte techniki

- **Mapped type z key remapping** (`[K in keyof T as ...]`) — mapped type żyje w `type`, nie w `interface`
- **Template literal types** do budowy nazw metod: `` `getAll${Capitalize<K>}s` ``
- **`Capitalize<K>`** — `"movie"` → `"Movie"`
- **Indexed access** `DataEntityMap[K]` — typ encji podąża za kluczem (raz `Movie`, raz `Song`)
- **Intersekcja `&`** — sklejenie czterech rodzin w jeden typ z wszystkimi metodami naraz
- **`implements`** — wymusza kontrakt na klasie
- **`#` prywatne pola** — realna enkapsulacja w runtimie (patrz pułapka niżej)
- **Storage jako mapa po id** `{ [id: string]: Entity }` zamiast tablicy

### Kod — kontrakt

```typescript
export type DataEntityMap = {
  movie: Movie;
  song: Song;
};

export type GetEntityMethods = {
  [K in keyof DataEntityMap as `get${Capitalize<K>}`]: (
    id: string,
  ) => DataEntityMap[K] | undefined; // pojedynczy lookup → może nie znaleźć
};

export type GetAllEntitiesMethods = {
  [K in keyof DataEntityMap as `getAll${Capitalize<K>}s`]: () => DataEntityMap[K][];
  // kolekcja ZAWSZE istnieje (bywa pusta) → BEZ | undefined
};

export type AddEntityMethods = {
  [K in keyof DataEntityMap as `add${Capitalize<K>}`]: (
    entity: DataEntityMap[K],
  ) => void;
};

export type ClearEntitiesMethods = {
  [K in keyof DataEntityMap as `clear${Capitalize<K>}s`]: () => void;
};

// sklejenie w jeden kontrakt
export type AllDataMethods = GetEntityMethods &
  GetAllEntitiesMethods &
  AddEntityMethods &
  ClearEntitiesMethods;
```

### Kod — klasa

```typescript
export class DataStore implements AllDataMethods {
  #movies: { [id: string]: Movie } = {};
  #songs: { [id: string]: Song } = {};

  addMovie(movie: Movie): void {
    this.#movies[movie.id] = movie; // computed key: [wyrażenie]
  }
  getMovie(id: Movie["id"]): Movie | undefined {
    return this.#movies[id]; // mapa → lookup po id w O(1)
  }
  getAllMovies(): Movie[] {
    return Object.values(this.#movies);
  }
  clearMovies(): void {
    this.#movies = {};
  }
  // ...analogicznie song
}
```

> Uwaga: `implements` można też podać listą (`implements A, B, C, D`) bez scalonego `AllDataMethods`.
> Scalony typ to wygoda — jedna nazwa na „pełny publiczny kształt store'a", przydatna gdy chcę się do
> niego odwołać gdzie indziej (typ z factory, atrapa w teście). Sam `implements` go nie wymaga.

### Pułapki złapane po drodze

| Pułapka                       | Źle                          | Dobrze                                       |
| ----------------------------- | ---------------------------- | -------------------------------------------- |
| Mapped type w `interface`     | `interface X { [K in ...] }` | tylko `type X = { [K in ...] }`              |
| `type` bez `=`                | `type X { ... }`             | `type X = { ... }` (alias → przypisanie)     |
| `getAll` z `\| undefined`     | kolekcja „może nie istnieć"  | kolekcja zawsze istnieje, bywa pusta → `T[]` |
| Zaszyty return                | `=> Movie` na sztywno        | `=> DataEntityMap[K]` (podąża za kluczem)    |
| Klucz z kropką                | `{ movie.id: movie }`        | `{ [movie.id]: movie }` (computed key)       |
| Zagnieżdżony `{}` w spreadzie | `{ ...m, { [id]: v } }`      | `{ ...m, [id]: v }`                          |
| `private` zamiast `#`         | widoczne w `Object.keys`     | `#` → naprawdę znika z instancji w runtimie  |

### Dlaczego `#`, a nie `private` (kluczowy insight)

Wymóg: instancja nie może mieć widocznych properties poza metodami.

- `private` = fikcja kompilatora. `Object.keys(store)` i tak zwraca `["movies","songs"]` w runtimie.
- `#` = realna prywatność. `Object.keys(store)` → `[]`. Pole istnieje i działa, ale z zewnątrz niewidoczne.

Zweryfikowane: `tsc --strict --noEmit` → 0 błędów; `Object.keys(store)` → `[]`.

### Test wartości wzorca

Dopisanie `book: Book` do `DataEntityMap` (i nic więcej) natychmiast wymusza `getBook`, `getAllBooks`,
`addBook`, `clearBooks` — klasa nie skompiluje się bez nich. Mapa jest jedynym źródłem prawdy.

### Kiedy używać / uwaga o skali

To wzorzec **library / infrastruktury** (`infer`, mapped types, key remapping). W zwykłym kodzie
aplikacyjnym zwykle przesada — uzasadniony, gdy realnie generujesz powtarzalne API z jednej definicji.

## Template literal types jako dopasowanie _struktury_ stringa

**Insight:** `A extends B` pyta „czy A jest podtypem B". To zła narzędzie dla pytań o _kształt_ stringa („zaczyna się na", „kończy się na", „zawiera"). Do kształtu służą **template literal types** — opisujesz wzorzec z `${string}` jako „cokolwiek".

```typescript
type StartsWith<A, B extends string> = A extends `${B}${string}` ? true : false;
type EndsWith<A, B extends string> = A extends `${string}${B}` ? true : false;
type Contains<A, B extends string> = A extends `${string}${B}${string}`
  ? true
  : false;
```

Kierunek: konkret + `string` = _startsWith_; `string` + konkret = _endsWith_.

**Dlaczego `B extends string`:** interpolacja `${B}` wymaga typu, który da się zrzutować na string. Bez constraintu `B` mogłoby być `object`/`symbol` → błąd. Constraint gwarantuje sensowność `${B}`.

**Gotcha — pusty prefiks/sufiks za darmo:** `${string}` obejmuje `""`. Dlatego `EndsWith<"cream", "cream">` → `true` (bo `"cream" = "" + "cream"`) bez żadnego kodu specjalnego. Rozwiązania rekurencyjne (odcinanie znaku po znaku) gubią ten przypadek — wzorzec z `${string}` obsługuje go z definicji.

---

## Constraint to **bramka**, nie **definicja**

**Insight:** `A extends X` w parametrze generycznym NIE znaczy „A _jest_ typem X". To górna granica (upper bound) — warunek wstępny, który tylko _odrzuca_ argumenty niespełniające go. W ciele typu `A` jest tym, co **faktycznie przekazano**, zawężonym najwyżej przez constraint, nie _zastąpionym_ nim.

```typescript
type Concat<A extends any[], B extends any[]> = [...A, ...B];

Concat<[18, 19], [20, 21]>; // A = [18, 19] — pełna tupla, nie number[]
// → [18, 19, 20, 21]
```

**Kontrast z adnotacją (ta sama składnia `any[]`, dwa mechanizmy):**

```typescript
const x: any[] = [18, 19]; // przypisanie w dół → typ TRACONY, typeof x = any[]
type C<A extends any[]> = A; // górna granica → typ ZACHOWANY, A = to, co przyszło
```

- **Adnotacja** = przypisanie do szerszego typu → informacja wymazana (widening).
- **Constraint** = tylko bramka na wejściu → informacja nietknięta.

**Po co tu w ogóle constraint:** spread na tupli wymaga typu tablicowego. Bez `extends any[]`:

```
type Concat<A, B> = [...A, ...B];
// A rest element type must be an array type. (2574)
```

Czyli constraint to nie „walidacja wejścia użytkownika", tylko **warunek konieczny, żeby ciało typu było w ogóle poprawne**.

**Gotcha — constraint nie DODAJE precyzji:** `A` pamięta konkretną tuplę tylko dlatego, że _wywołujący_ przekazał tuplę. Jeśli na wejściu jest już `number[]`, to `A = number[]`:

```typescript
const arr: number[] = [18, 19];
type R = Concat<typeof arr, [20]>; // A = number[] → number[], NIE [18, 19, 20]
```

Constraint nie spłaszcza — po prostu nie odbiera precyzji, której nie było.

---

### Powtórki (spaced repetition)

Odpowiedz z głowy, zanim spojrzysz wyżej:

- **[1 dzień]** Napisz `EndsWith<A, B>`. Dlaczego `B extends string`? Dlaczego `EndsWith<"cream","cream">` daje `true` bez dodatkowego kodu?
- **[1 tydzień]** `Concat<[18,19],[20,21]>` daje `[18,19,20,21]`, nie `number[]`. Dlaczego constraint `extends any[]` nie spłaszcza `A`? Czym różni się to od `const x: any[] = [18,19]`?
- **[1 miesiąc]** Jednym zdaniem: constraint to **\_\_**, nie **\_\_**. Podaj przypadek, w którym `Concat` MIMO tupli w teście zwróci szeroki typ tablicowy — i wyjaśnij, że to nie wina constraintu.

# ReturnOf — `infer` na typach funkcyjnych

_Sesja: type challenge `ReturnOf`. Do dopięcia do `making-typescript-patterns.md`._

---

## Rozwiązanie

```typescript
type ReturnOf<F extends (...args: any[]) => any> = F extends (
  ...args: any[]
) => infer R
  ? R
  : never;
```

Wariant instruktora (równoważny w ciele, bez constraintu):

```typescript
type ReturnOf<F> = F extends { (...arg: any[]): infer RT } ? RT : never;
```

---

## 1. Przypisywalność funkcji ze względu na liczbę parametrów

**Reguła: mniej parametrów jest przypisywalne tam, gdzie oczekiwano więcej. Nie odwrotnie.**

Wyprowadzenie — kluczowe pytanie brzmi _kto dostarcza argumenty_. Dostarcza je **wywołujący**, nie funkcja.

```typescript
declare function callIt(f: () => string): void;
// ciało: const result = f();   ← woła bez argumentów

const needsArg = (prefix: string) => prefix.toUpperCase();
callIt(needsArg); // ❌ callIt zrobi f(), prefix === undefined, runtime crash
```

Odwrotnie jest bezpiecznie, bo JS ignoruje nadmiarowe argumenty:

```typescript
const noArgs = () => 42;
noArgs("cokolwiek", 1, 2, 3); // ✅ 42, argumenty lądują w `arguments` i nikt ich nie tyka
```

To fundament, na którym stoi `[1,2,3].map(x => x * 2)` — callback `map` ma sygnaturę
`(value, index, array) => U`, a przekazujesz funkcję z jednym parametrem. Działa.

> To ta sama logika co przy `readonly any[]`: **mniejsze wymagania → bezpiecznie
> podstawialne tam, gdzie oczekiwano bardziej wymagającego kontraktu.**

**Konsekwencja dla zadania:** `() => {}` jako wzorzec **odpada** — wymaga zera parametrów,
a `rockPaperScissors` bierze jeden. Trzeba `(...args: any[])`.

**Efekt uboczny tej samej reguły:** `[1,2,3].map(parseInt)` → `[1, NaN, NaN]`, bo `parseInt`
przyjmuje drugi argument (radix) i dostaje tam index.

---

## 2. `{}` to NIE „pusty obiekt"

`{}` znaczy **„cokolwiek, co nie jest `null` ani `undefined`"** — czyli cokolwiek, na czym
da się bezpiecznie zrobić `.toString()`.

```typescript
type A = number extends {} ? true : false; // true
type B = string extends {} ? true : false; // true
type C = boolean extends {} ? true : false; // true
type D = null extends {} ? true : false; // false
type E = undefined extends {} ? true : false; // false
type G = void extends {} ? true : false; // false
```

**Konsekwencja:** w constraincie funkcji dajesz `any` po strzałce, nie `{}` — inaczej
wycinasz funkcje zwracające `void`, `null` i `undefined`.

---

## 3. `infer` na typie przeciążonym → TS bierze **ostatnią** sygnaturę

```typescript
interface Over {
  (): string;
  (x: number): boolean;
}
type Got = ReturnOf<Over>; // boolean — ostatnia, nie unia, nie „najlepsza"
```

To celowy kompromis kompilatora, nie bug.

**Przypadek z zadania:**

```typescript
type p = ReturnOf<(typeof Promise)["resolve"]>; // Promise<unknown>
```

`Promise.resolve` w `lib.es5.d.ts` ma ~3 przeciążenia:

```typescript
resolve(): Promise<void>;
resolve<T>(value: T): Promise<Awaited<T>>;
resolve<T>(value: T | PromiseLike<T>): Promise<Awaited<T>>;
```

Brana jest ostatnia, a jej `T` nigdy nie zostaje rozwiązany (nikt tej funkcji nie wywołał)
→ `Promise<Awaited<unknown>>` → `Promise<unknown>`.

⚠️ **Komentarz w zadaniu (`// here should be void`) jest nieaktualny.** Żadne przeciążenie
nie zwraca gołego `void`; pierwsze zwraca `Promise<void>`. Kolejność przeciążeń w
`lib.es5.d.ts` zmieniała się między wersjami TS. → _Zaufaj `lib.es5.d.ts`, nie komentarzowi
w ćwiczeniu._

---

## 4. `infer` nie rozwija rekurencyjnie

```typescript
ReturnOf<() => () => "foo">; // () => "foo", NIE "foo"
```

`infer` to czyste dopasowanie wzorca strukturalnego — łapie to, co stoi w danym miejscu, i
koniec. Rekurencja w typach jest **zawsze jawna**:

```typescript
type DeepReturnOf<F> = F extends (...args: any[]) => infer R
  ? R extends (...args: any[]) => any
    ? DeepReturnOf<R>
    : R
  : never;
```

---

## 5. Dystrybucja — co się dystrybuuje, a co nie

Dystrybuowany jest **`F`**, nie to, co siedzi w środku `F`.

```typescript
// NIE dystrybuuje — F to jeden typ funkcji, unia jest w środku
ReturnOf<() => "heads" | "tails">; // "heads" | "tails"  ✅ w całości

// DYSTRYBUUJE — F jest unią i stoi jako goły parametr po lewej stronie extends
ReturnOf<((x: string) => number) | (() => boolean)>; // number | boolean
```

Wyłączenie dystrybucji (owinięcie obu stron w tuplę → `F` przestaje być gołym parametrem):

```typescript
type ReturnOfNoDistribute<F extends (...args: any[]) => any> = [F] extends [
  (...args: any[]) => infer R,
]
  ? R
  : never;
// dla unii da: number — unia funkcji traktowana jak przeciążenia, czyli ostatnia
```

---

## 6. Constraint vs. brak constraintu — tradeoff i **propagacja**

Najpierw fakt, który rozstrzyga „constraint **albo** ciało": **to fałszywa alternatywa.**
Sam constraint nie daje żadnej _nazwy_ na typ zwracany — uchwyt powstaje wyłącznie przy
dopasowaniu wzorca. Conditional type w ciele musi być tak czy siak. Pytanie brzmi tylko:
**czy dokładam constraint na dodatek?**

|                                 | z constraintem                 | bez constraintu         |
| ------------------------------- | ------------------------------ | ----------------------- |
| `ReturnOf<string>`              | ❌ błąd w miejscu wywołania    | 🤫 cicho zwraca `never` |
| użycie na nierozwiązanym `T[K]` | wymaga propagacji w górę       | działa od ręki          |
| zgodność z `lib.es5.d.ts`       | `ReturnType` **ma** constraint | —                       |

### Propagacja constraintu

Constraint **nie zostaje tam, gdzie go postawiłeś.** Każdy typ, który używa twojego typu na
nierozwiązanym parametrze, musi ten sam warunek powtórzyć w swojej sygnaturze:

```typescript
type ReturnsOfAll<T extends Record<string, (...args: any[]) => any>> = {
  //             ^^^^^^^^^ musiałem powtórzyć constraint z ReturnOf
  [K in keyof T]: ReturnOf<T[K]>;
};
```

Bez tego kompilator w linijce `ReturnOf<T[K]>` widzi tylko `unknown` — sprawdza
`ReturnsOfAll` raz, w oderwaniu od konkretnego argumentu. Warstwa wyżej (`ReturnsOfAllDeep`)
powtórzy to jeszcze raz. I tak przez pięć poziomów.

W wariancie bez constraintu żadna warstwa nic nie deklaruje — `never` przepływa w dół.

**Wniosek:** `ReturnType` z `lib.es5.d.ts` świadomie płaci tę cenę, bo jest przeznaczony do
wołania na **konkretnym, znanym** typie funkcji — nie jako klocek do budowania maszynerii
typów.

---

## 7. Call signature — dlaczego u instruktora nie ma strzałki

```typescript
type A = (x: number) => string; // function type expression (skrót)
type B = { (x: number): string }; // call signature — TEN SAM TYP
```

Strzałki nie ma, bo w wersji `B` jesteś w środku ciała typu obiektowego, a tam **wszystkie
składowe** deklaruje się przez `:`. Call signature to po prostu składowa **bez nazwy**:

```typescript
interface Foo {
  bar(): number; // metoda o nazwie "bar"
  (): number; // call signature — sam obiekt jest wywoływalny
}
```

### Po co dłuższa forma, skoro jest skrót

Skrót ze strzałką wyraża **tylko jedną** sygnaturę. Forma obiektowa potrafi więcej:

```typescript
// przeciążenia — nie do zapisania strzałką
type Overloaded = {
  (): string;
  (x: number): boolean;
};

// funkcja z własnościami — też nie do zapisania strzałką
type WithProps = {
  (x: number): string;
  cache: Map<number, string>;
};
```

Dlatego `typeof Promise["resolve"]` (przeciążone!) w ogóle da się opisać.

---

## 8. Drobiazgi

- **`Record<string, X>` vs sygnatura indeksowa** `{ [key: string]: X }` — to samo, `Record`
  to cukier. Uwaga: `string` jako klucz **nie obejmuje** kluczy symbolowych ani numerycznych;
  czasem trzeba `PropertyKey`.
- **`any[]` vs `any` w rest paramecie** — `lib.es5.d.ts` używa `(...args: any) => any`, bez
  tablicy. Celowo: `any` w pozycji rest jest jeszcze bardziej permisywne (dopasuje np.
  sygnatury z `this`). Do typowych zastosowań `any[]` wystarcza.
- **Debugging:** gdy TS sypie kaskadą dziwnych błędów wokół jednej linijki, a komunikaty
  mówią o czymś, czego nie pisałeś (np. o wartości domyślnej parametru generycznego) —
  pierwsze podejrzenie to **niedomknięty nawias**, nie problem z typami.

---

## Cold recall

_Odpowiedz z głowy, potem sprawdź w edytorze._

1. Funkcja o jednym parametrze — czy przejdzie tam, gdzie oczekiwano `() => void`? Uzasadnij
   przez pytanie „kto dostarcza argumenty".
2. Wypisz z pamięci, które z tych przechodzą `extends {}`: `number`, `null`, `void`,
   `undefined`, `string`.
3. `infer` na typie z trzema przeciążeniami — którą sygnaturę bierze TS?
4. Co zwróci `ReturnOf<() => () => "foo">` i dlaczego nie `"foo"`?
5. Dlaczego `ReturnOf<() => "a" | "b">` **nie** dystrybuuje, a
   `ReturnOf<(() => "a") | (() => "b")>` dystrybuuje?
6. Jak wyłączyć dystrybucję w conditional type?
7. Zapisz `(x: number) => string` w formie call signature. Dlaczego nie ma strzałki?
8. Co to „propagacja constraintu" i dlaczego `ReturnType` mimo niej ma constraint?

**Powtórki:** 1 dzień → 1 tydzień → 1 miesiąc.

# `lib.es5.d.ts` — co to jest i po co istnieje

## W skrócie

`lib.es5.d.ts` to plik deklaracji typów wchodzący w skład samego kompilatora TypeScript. Znajduje się w:

```
node_modules/typescript/lib/lib.es5.d.ts
```

Opisuje typy wszystkiego, co daje standard **ECMAScript 5** — czyli sam język, bez jakiegokolwiek środowiska uruchomieniowego.

---

## Co zawiera

### Interfejsy globalnych obiektów

`Object`, `Array<T>`, `String`, `Number`, `Boolean`, `Function`, `Date`, `RegExp`, `Math`, `JSON`, `Error`

### Funkcje globalne

`parseInt`, `parseFloat`, `isNaN`, `isFinite`, `encodeURIComponent`, `decodeURIComponent`

### Typy pomocnicze (utility types)

Te, których używasz na co dzień:

| Typ             | Działanie                               |
| --------------- | --------------------------------------- |
| `Partial<T>`    | wszystkie pola opcjonalne               |
| `Required<T>`   | wszystkie pola wymagane                 |
| `Readonly<T>`   | wszystkie pola tylko do odczytu         |
| `Pick<T, K>`    | wybiera podzbiór pól                    |
| `Omit<T, K>`    | usuwa wskazane pola                     |
| `Record<K, T>`  | obiekt o kluczach `K` i wartościach `T` |
| `ReturnType<T>` | typ zwracany przez funkcję              |
| `Parameters<T>` | krotka typów argumentów                 |
| `Awaited<T>`    | rozpakowuje `Promise`                   |

> **Ciekawostka:** `Partial` i spółka technicznie nie mają nic wspólnego z ES5 — historycznie wylądowały właśnie w tym pliku i tak już zostało.

---

## Dlaczego rozszerzenie `.d.ts`

`.d.ts` = _declaration file_. Plik zawiera **wyłącznie deklaracje typów, zero implementacji**. Nie kompiluje się do JavaScriptu, nie trafia do bundla. To czysta informacja dla kompilatora: „takie rzeczy istnieją w runtime i mają takie sygnatury".

```ts
interface Array<T> {
  length: number;
  push(...items: T[]): number;
  pop(): T | undefined;
  // ...same sygnatury, bez ciał funkcji
}
```

---

## Kiedy jest ładowany

Zależy od opcji `target` i `lib` w `tsconfig.json`.

```jsonc
{
  "compilerOptions": {
    "target": "ES2020", // wciąga lib.es2020.d.ts
  },
}
```

Pliki `lib.*.d.ts` tworzą łańcuch przez dyrektywy `/// <reference>`:

```
lib.es2020.d.ts → lib.es2019.d.ts → lib.es2018.d.ts → ... → lib.es5.d.ts
```

**`lib.es5.d.ts` jest zawsze na dole stosu**, niezależnie od wybranego targetu.

### Klasyczny błąd początkującego

```
Property 'includes' does not exist on type 'string[]'
```

`Array.prototype.includes` to ES2016, więc siedzi w `lib.es2016.array.include.d.ts`. Przy `"target": "ES5"` ten plik nie jest ładowany i TypeScript po prostu nie wie, że metoda istnieje.

**Rozwiązanie:** podnieś `target` albo dodaj jawnie bibliotekę:

```jsonc
{
  "compilerOptions": {
    "target": "ES5",
    "lib": ["ES5", "ES2016.Array.Include"],
  },
}
```

---

## Czego tam **nie** ma

| Czego szukasz                                 | Gdzie to jest                                                |
| --------------------------------------------- | ------------------------------------------------------------ |
| `document`, `window`, `fetch`, `localStorage` | `lib.dom.d.ts` (domyślnie dołączany; wyłączysz jawnym `lib`) |
| `process`, `Buffer`, `fs`                     | pakiet `@types/node` (osobna zależność)                      |
| `Promise`, `Symbol`, `Map`, `Set`             | `lib.es2015.*.d.ts`                                          |

`lib.es5.d.ts` to **czysty język** — nic o przeglądarce, nic o Node.

---

## Wskazówka przy nauce

Warto do tego pliku zaglądać. W VS Code kliknij `Ctrl` / `Cmd` + klik na dowolną wbudowaną metodę (np. `map`) — wylądujesz dokładnie w `lib.es5.d.ts`.

To jedno z najlepszych dostępnych źródeł do nauki dobrze napisanych generyków i przeciążeń. Przykład — sygnatury `Array.prototype.reduce`:

```ts
interface Array<T> {
  reduce(
    callbackfn: (
      previousValue: T,
      currentValue: T,
      currentIndex: number,
      array: T[],
    ) => T,
  ): T;

  reduce(
    callbackfn: (
      previousValue: T,
      currentValue: T,
      currentIndex: number,
      array: T[],
    ) => T,
    initialValue: T,
  ): T;

  reduce<U>(
    callbackfn: (
      previousValue: U,
      currentValue: T,
      currentIndex: number,
      array: U[],
    ) => U,
    initialValue: U,
  ): U;
}
```

Trzy przeciążenia, a każde uczy czegoś innego o tym, jak TypeScript wnioskuje typy:

1. bez wartości początkowej — akumulator musi być typu `T`
2. z wartością początkową typu `T` — to samo, ale bezpieczniej
3. z generykiem `U` — akumulator może być zupełnie innym typem niż elementy tablicy

---

## Podsumowanie

- to plik z **typami**, nie z kodem
- opisuje **rdzeń języka** (ES5), nie środowisko
- ładuje się **zawsze**, jako fundament pod wszystkie nowsze `lib.es20xx.d.ts`
- zawiera utility types (`Partial`, `Pick`, `Record`, ...)
- świetne źródło do nauki zaawansowanego TypeScriptu

# Type Challenge: `Split<S, SEP>`

## Zadanie

Zaimplementować odpowiednik `String.prototype.split` na poziomie typów.

```typescript
type Split<S extends string, SEP extends string> = string extends S
  ? string[]
  : S extends ""
    ? SEP extends ""
      ? []
      : [""]
    : S extends `${infer frag}${SEP}${infer rest}`
      ? [frag, ...Split<rest, SEP>]
      : [S];
```

## Jak się do tego dochodzi

**Kształt rekurencji.** Każda rekurencja na typach wygląda tak samo: _odetnij kawałek → wywołaj sam siebie na reszcie → sklej_. Tutaj kawałkiem jest fragment przed pierwszym separatorem, resztą — wszystko po nim.

**Krok 1 — rdzeń.** Najpierw wersja bez przypadków brzegowych. Przechodzi testy 1, 2 i 5:

```typescript
type Split<
  S extends string,
  SEP extends string,
> = S extends `${infer frag}${SEP}${infer rest}`
  ? [frag, ...Split<rest, SEP>]
  : [S];
```

Warunek stopu to gałąź `false`: „nie ma już separatora" → zwróć `[S]`, czyli cały pozostały string jako jednoelementowa tupla. Widać to wprost w teście `Split<"Hi! How are you?", "z"> === ["Hi! How are you?"]`.

**Krok 2 — pusty string.** Dla `SEP = ""` na końcu doklejał się śmieciowy `""`, a `Split<"", "">` dawało `[""]` zamiast `[]`. Ten sam błąd w dwóch przebraniach. Fix: strażnik na wejściu z zagnieżdżonym sprawdzeniem `SEP`.

**Krok 3 — szeroki `string`.** `Split<string, "whatever">` musi dać `string[]`. Wymaga osobnego strażnika **na samej górze**.

## Tematy poboczne

### `extends` to przynależność do zbioru, nie zawieranie tekstu

Typ = zbiór wartości. `X extends Y` znaczy „każda wartość z X należy do Y".

- `""` to zbiór jednoelementowy `{ "" }`
- `"abc"` to zbiór `{ "abc" }`
- `string` to zbiór wszystkich stringów

Stąd `"abc" extends ""` → `false`. Nie ma to nic wspólnego z tym, że pusty string „mieści się" w każdym stringu.

Template literal type to też zbiór — wszystkich stringów pasujących do wzorca, zwykle nieskończony. Ta sama reguła, inny zbiór.

### `extends` nie jest symetryczne — i to jest narzędzie

|                    | `S = string` | `S = "abc"` |
| ------------------ | ------------ | ----------- |
| `S extends string` | `true`       | `true`      |
| `string extends S` | `true`       | `false`     |

Górny wiersz nie rozróżnia niczego. Dolny — rozróżnia. **Odwrócenie kierunku `extends` to sposób na wykrycie typu szerokiego.**

Ten sam trik w innych przebraniach:

```typescript
string extends S      // czy S to szeroki string, czy literał?
[T] extends [never]   // czy T to never?
0 extends 1 & T       // czy T to any?
```

### Reguła dopasowania sąsiadujących `infer`

We wzorcu `` `${infer A}${infer B}` `` pierwsza dziura musi połknąć **co najmniej jeden znak**, druga może zostać pusta.

```typescript
"ab" extends `${infer A}${infer B}`  // true:  A = "a", B = "b"
"a"  extends `${infer A}${infer B}`  // true:  A = "a", B = ""
""   extends `${infer A}${infer B}`  // false: nie ma z czego wziąć znaku
```

Dodatkowo dopasowanie jest **najkrótsze możliwe** — przy `"a b c"` i separatorze `" "` dostajemy `frag = "a"`, `rest = "b c"`, czyli podział na _pierwszym_ wystąpieniu. Dokładnie to, czego chce `split`.

### Koniunkcja w typach warunkowych

Nie ma `&&`. Koniunkcję robi się przez zagnieżdżenie — wejście w wewnętrzny ternary oznacza, że zewnętrzny warunek już jest prawdą:

```typescript
A extends X
  ? B extends Y ? /* A i B */ : /* A, ale nie B */
  : /* nie A */
```

### Szeroki `string` nigdy nie dopasuje wzorca

`string extends \`${infer a}whatever${infer b}\``→`false`, bo `"kot"`należy do`string`, ale nie do zbioru stringów zawierających „whatever".

Konsekwencja: `string` nie da się „przerobić" rekurencją, bo rekurencja nie ma o co zaczepić — po prostu spada do gałęzi `false` i zwraca `[S]`. Trzeba go **rozpoznać i odesłać osobną odpowiedzią**, i to zanim wejdzie w resztę maszynerii. Stąd kolejność strażników w rozwiązaniu.

### `string[]` vs `[string]`

- `string[]` — tablica o dowolnej długości, elementy typu `string`
- `[string]` — tupla o dokładnie jednym elemencie

Dla `Split<string, ...>` poprawne jest `string[]`: nie wiadomo, ile fragmentów powstanie, bo nie wiadomo, co to za string.

## Metoda pracy

Nie zgaduj, co zwraca twój typ — sprawdź. Najedź kursorem na alias albo postaw próbkę:

```typescript
type Probe = Split<"abc", "">;
//   ^ hover
```

Buduj przyrostowo: najpierw rdzeń bez przypadków brzegowych, odpal testy, zobacz które padają, dopiero wtedy dokładaj strażników. Kilka padających testów często ma jedną wspólną przyczynę.

# Dopasowywanie template literal types — metoda eksperymentalna

Notatka poboczna do challenge'u `Split<S, SEP>`. Punkt wyjścia: instruktor nie pisał rozwiązania z pamięci, tylko stawiał najmniejszy możliwy eksperyment i czytał wynik z edytora.

## Eksperyment zerowy

```typescript
type Split<
  S extends string,
  SEP extends string,
> = S extends `${infer Rest}${SEP}` ? Rest : S;

let x: Split<"hello world", " ">; // "hello world"
let y: Split<"hello world ", " ">; // "hello world"
```

Ten wzorzec nie jest krokiem w stronę rozwiązania — jest sondą. Sprawdza, jak w ogóle zachowuje się dopasowanie, zanim zacznie się budować rekurencję.

Uwaga na pułapkę: `x` i `y` dają **ten sam wynik dwiema różnymi drogami**. `x` wpada w gałąź `false` i zwraca `S` nietknięte, `y` wpada w `true` i `Rest` łapie wszystko przed spacją. Patrzenie wyłącznie na wynik nie mówi, którą gałęzią poszedł typ.

## Jak czytać wzorzec

`` S extends `${infer A}${SEP}` `` to pytanie: _czy `S` należy do zbioru wszystkich stringów pasujących do tego wzorca?_

Kluczowe jest to, czego we wzorcu **nie ma**. Po `${SEP}` nie stoi nic, więc zbiór to nie „stringi zawierające spację", tylko węższy: „stringi **kończące się** spacją". `"hello world"` do niego nie należy.

## Trzy warianty pozycji separatora

Pozycja `${SEP}` decyduje o wszystkim. Każdy wariant zadaje inne pytanie:

```typescript
`${infer A}${SEP}`              // czy S kończy się na SEP?
`${SEP}${infer A}`              // czy S zaczyna się od SEP?
`${infer A}${SEP}${infer B}`    // czy S zawiera SEP gdziekolwiek?
```

Dla `Split` potrzebny jest trzeci — tylko on pozwala odciąć fragment i zostawić resztę do dalszej rekurencji.

## Reguła dopasowania

> TS dopasowuje wzorzec od lewej do prawej. Każda dziura bierze **najkrótszy** fragment, przy którym **reszta wzorca nadal ma szansę się dopasować**.

Drugie zdanie jest ważniejsze od pierwszego. „Najkrótsze" to nie zachcianka, tylko preferencja **rozstrzygająca remisy** — a remis istnieje tylko tam, gdzie w ogóle jest wybór.

### Dowód na dwóch przykładach

```typescript
type P = "a b c " extends `${infer A}${" "}` ? A : never;
// => "a b c"   (NIE "a")

type Q = "a b c" extends `${infer A}${" "}${infer B}` ? [A, B] : never;
// => ["a", "b c"]
```

| wzorzec                            | co musi zostać po `A`               | najkrótsze `A`, które to spełnia |
| ---------------------------------- | ----------------------------------- | -------------------------------- |
| `` `${infer A}${" "}` ``           | **dokładnie** jedna spacja i koniec | `"a b c"`                        |
| `` `${infer A}${" "}${infer B}` `` | spacja + cokolwiek (może być puste) | `"a"`                            |

W `P` istnieje dokładnie jedno `A`, które działa — preferencja „najkrótsze" nie ma czego rozstrzygać. Gdyby `A = "a"`, to po nim zostałoby `"b c "`, a wzorzec wymaga dokładnie `" "`.

W `Q` pasowałyby trzy różne rozbicia (`["a", "b c"]`, `["a b", "c"]`, `["a b c", ""]` — to ostatnie nie, bo brakuje spacji, ale idea jest jasna) i dopiero tam reguła wybiera najkrótsze `A`.

### Test kontrolny

```typescript
type R = "a b c " extends `${infer A}${" "}${infer B}` ? [A, B] : never;
// => ["a", "b c "]
```

Ten sam string co w `P`, ten sam wzorzec co w `Q`. Reszta wzorca to `spacja + cokolwiek`, więc pierwsza spacja wystarcza i `A` nie sięga dalej. Końcowa spacja wpada do `B`.

**Konsekwencja praktyczna:** wzorzec `` `${infer A}${SEP}${infer B}` `` dzieli na **pierwszym** wystąpieniu separatora. Dokładnie tego chce `split`.

## Minimum jednego znaku

Osobna reguła, niezależna od powyższej. W `` `${infer A}${infer B}` `` — dwie sąsiadujące dziury bez tekstu między nimi — pierwsza musi połknąć **co najmniej jeden znak**:

```typescript
"ab" extends `${infer A}${infer B}`  // true:  A = "a", B = "b"
"a"  extends `${infer A}${infer B}`  // true:  A = "a", B = ""
""   extends `${infer A}${infer B}`  // false: nie ma z czego wziąć znaku
```

To właśnie ta reguła sprawia, że `Split<S, "">` tnie po jednym znaku — i że rekurencja zatrzymuje się na pustym stringu, zamiast lecieć w nieskończoność.

## Szeroki `string` nie dopasuje żadnego wzorca ze stałym tekstem

```typescript
string extends `${infer A}whatever${infer B}` ? true : false  // false
```

Bo `"kot"` należy do `string`, ale nie do zbioru stringów zawierających „whatever". Zbiór szerszy nie mieści się w węższym.

Konsekwencja: `string` nie da się przerobić rekurencją — trzeba go rozpoznać strażnikiem `string extends S` i odesłać osobną odpowiedzią, zanim wejdzie w maszynerię wzorców.

## Metoda

1. Postaw najmniejszy możliwy wzorzec i przypisz go do zmiennej.
2. Najedź kursorem. Przeczytaj wynik. **Nie zgaduj.**
3. Zmień jedną rzecz — pozycję separatora, obecność dziury na końcu, jeden znak w wejściu.
4. Porównaj. Różnica między dwoma eksperymentami mówi więcej niż każdy z osobna.
5. Sprawdzaj wejścia brzegowe (`""`, jednoznakowe, ze spacją na końcu) **od razu**, nie na końcu — tam siedzą wszystkie niespodzianki.

Gdy wynik przeczy intuicji, wygrywa edytor.

# IsTuple — rozwiązanie i dedukcja

## Zadanie

Napisać typ, który zwraca `true` dla krotek (tuples) i `false` dla wszystkiego innego.

```typescript
type cases = [
  Expect<Equal<IsTuple<[]>, true>>,
  Expect<Equal<IsTuple<[number]>, true>>,
  Expect<Equal<IsTuple<readonly [1]>, true>>,
  Expect<Equal<IsTuple<{ length: 1 }>, false>>,
  Expect<Equal<IsTuple<number[]>, false>>,
];
```

## Rozwiązanie

```typescript
type IsTuple<T> = T extends readonly any[]
  ? number extends T["length"]
    ? false
    : true
  : false;
```

## Tok rozumowania

**Krok 1 — sprawdzenie czy to w ogóle tablica.**

```typescript
type IsTuple<T> = T extends readonly any[] ? true : false;
```

Przy takiej wersji nie przechodzi tylko jeden test: `IsTuple<number[]>` daje `true`, a ma dać `false`. Potrzebne jest dodatkowe kryterium odróżniające krotkę od zwykłej tablicy.

**Krok 2 — czym różni się krotka od tablicy.**

Długością. Krotka ma długość znaną w czasie kompilacji, tablica nie:

```typescript
type A = []["length"]; // 0
type B = [number]["length"]; // 1
type C = number[]["length"]; // number
```

Krotki mają **literalną** długość (`0`, `1`, `2`...), zwykłe tablice mają `number`. To jest cały mechanizm rozwiązania.

**Krok 3 — jak zapytać o to warunkiem.**

```typescript
number extends T["length"] ? false : true
```

Kierunek `extends` jest tutaj kluczowy. Pytanie brzmi: „czy `number` jest przypisywalny do długości", czyli „czy długość jest tak samo szeroka jak `number`".

Odwrotny zapis byłby bezużyteczny — `T["length"] extends number` jest zawsze `true`, bo `0 extends number` też jest prawdą.

**Krok 4 — dlaczego kolejność warunków jest wymuszona.**

Nie da się dać `number extends T["length"]` przed sprawdzeniem, czy `T` jest tablicą. Dwa powody:

1. **Poprawność** — dla `{ length: 1 }` samo `number extends T["length"]` daje `number extends 1` → `false` → wynik `true`, a test wymaga `false`.
2. **Kompilacja** — dla typu bez `length` (np. `IsTuple<string>`) zapis `T["length"]` to błąd: _„Type 'length' cannot be used to index type 'T'"_. Dopiero wewnątrz gałęzi `true` TS wie, że `T` jest tablicą, więc indeksowanie jest legalne.

**Krok 5 — złożenie.**

```typescript
type IsTuple<T> = T extends readonly any[]
  ? number extends T["length"]
    ? false
    : true
  : false;
```

Czyta się to tak:

- czy `T` jest jakąkolwiek tablicą?
  - jeśli tak → czy pod `T["length"]` leży `number`?
    - tak → `false` (zwykła tablica)
    - nie → `true` (krotka, długość literalna)
  - jeśli nie → `false` (to w ogóle nie tablica)

`true` wychodzi wtedy i tylko wtedy, gdy `T` jest tablicą **i zarazem** jej `length` nie jest szerokim `number`.

## Dlaczego `readonly any[]`, a nie `any[]`

`readonly any[]` jest nadtypem `any[]` — każda zwykła tablica jest przypisywalna do readonly, ale nie odwrotnie. Dzięki temu jeden warunek łapie oba warianty i test `IsTuple<readonly [1]>` przechodzi.

---

# Dystrybutywność typów warunkowych

## Obserwacja

```typescript
type U = IsTuple<[1] | number[]>; // boolean
```

Choć typ potrafi zwrócić tylko `true` albo `false`, wynikiem jest `boolean`.

## Wyjaśnienie

`boolean` **nie jest** trzecim, osobnym typem. To alias na unię:

```typescript
type Boolean_ = true | false; // to JEST boolean
```

Typ warunkowy z **gołym** parametrem (`T extends ...`, bez opakowania) jest _dystrybutywny_: gdy `T` jest unią, TS nie sprawdza warunku raz na całej unii, tylko rozbija ją na człony, uruchamia typ osobno dla każdego i skleja wyniki w unię.

```typescript
IsTuple<[1] | number[]>;
//   IsTuple<[1]>       → true
//   IsTuple<number[]>  → false
//   wynik: true | false
//   normalizacja: boolean
```

Każde pojedyncze wywołanie zwróciło `true` lub `false` — wywołań było po prostu dwa.

Wyraźniej widać to bez normalizacji do `boolean`:

```typescript
type Distributive<T> = T extends string ? "tak" : "nie";
type R1 = Distributive<string | number>; // "tak" | "nie"
```

## Przypadki brzegowe

```typescript
type U = IsTuple<[1] | number[]>; // boolean  (dystrybucja)
type V = IsTuple<any>; // boolean  (any wchodzi w obie gałęzie)
type W = IsTuple<never>; // never    (pusta unia = brak członów)
```

W type-challenges nieoceniane, w realnym kodzie potrafi zaskoczyć.

## Jak wyłączyć dystrybucję

Opakowanie obu stron w krotkę zabiera parametrowi „gołość":

```typescript
type IsTupleStrict<T> = [T] extends [readonly any[]]
  ? number extends T["length"]
    ? false
    : true
  : false;

type R2 = IsTupleStrict<[1] | number[]>; // false
```

Dla `never` osobno: `[T] extends [never] ? false : ...`.

`[X] extends [Y]` sprowadza się do zwykłego `X extends Y` — elementy krotki porównuje się pozycja po pozycji. Opakowanie nie zmienia wyniku przypisywalności, wyłącza tylko rozbijanie unii.

---

# Przypisywalność unii

## Reguła

**Unia po lewej stronie jest przypisywalna do celu, gdy KAŻDY jej człon jest przypisywalny.**

```typescript
[1] | number[]  extends  readonly any[]
//   [1]      extends readonly any[]  → true
//   number[] extends readonly any[]  → true
//   → cała unia przechodzi
```

Intuicja od strony wartości: zmienna typu `[1] | number[]` trzyma _albo_ krotkę, _albo_ tablicę — ale cokolwiek trzyma, na pewno jest tablicą. Można ją bezpiecznie podać tam, gdzie oczekiwana jest tablica.

```typescript
declare const v: [1] | number[];
const arr: readonly any[] = v; // OK
v.length; // OK — .length istnieje w obu wariantach
```

## Kontrprzykład

```typescript
type R = IsTupleStrict<[1] | string>; // false
//   [1]    extends readonly any[]  → true
//   string extends readonly any[]  → false   ← jeden człon nie przechodzi
//   → cała unia nie przechodzi
```

## Uwaga na kierunek

Reguła „wszystkie człony" dotyczy unii po **lewej** stronie. Po **prawej** jest odwrotnie — wystarczy jeden pasujący człon:

```typescript
string          extends string | number   // true  — wystarczy trafić w jeden wariant
string | number extends string            // false — number nie pasuje
```

## Indexed access na unii

Rozkłada się po członach:

```typescript
([1] | number[])["length"]
//   [1]["length"]      → 1
//   number[]["length"] → number
//   wynik: 1 | number  →  TS redukuje do  number
```

Dlatego w `IsTupleStrict<[1] | number[]>` gałąź `true` daje `number extends number` → `false`. Sensowna odpowiedź: unia krotki i tablicy nie jest krotką.

## TupleToNestedObject (type-challenges 3188)

```typescript
type TupleToNestedObject<T, U> = T extends [
  infer head extends string,
  ...infer tail,
]
  ? Record<head, TupleToNestedObject<tail, U>>
  : U;
```

### Sprawdzanie pustej tablicy

`T extends readonly []` — to jest właściwy sposób.

- `readonly` po prawej łapie oba warianty; samo `[]` przepuściłoby `readonly []` jako `false`
- guard `T extends readonly any[]` niepotrzebny, bo `{ length: 0 }` nie jest przypisywalne do krotki (inaczej niż przy podejściu przez `T["length"]`)
- **`[never]` to nie pusta tablica** — to krotka o `length: 1` z elementem typu `never`. Niezamieszkana, ale nie pusta. Liczba elementów siedzi w `length` i w kształcie zapisu, nigdy w typie elementu
- `never[]` w runtime zawsze będzie pusta, ale `never[]["length"]` to `number`, więc `IsEmptyArray<never[]>` → `false`

### Typ jako klucz obiektu

`{ head: U }` tworzy property o **dosłownej nazwie** `head`. Żeby użyć typu jako klucza, potrzebny mapped type — dokładnie to, czym jest `Record`:

```typescript
type Record<K extends keyof any, T> = { [P in K]: T };
```

### infer ma własny bound

`infer head` deklaruje **świeżą** zmienną typu z bounddem `unknown`. Constraint z `T extends string[]` mówi coś o `T` i **nie propaguje się** do zmiennych ze wzorca — stąd błąd _„Type 'head' does not satisfy the constraint 'string | number | symbol'"_.

Kluczowe: TS sprawdza ciało typu **raz, generycznie**, zanim pozna konkretne `T`. To, że przy `T = ["a"]` head wyjdzie `"a"`, jest prawdą dopiero przy instancjonowaniu.

Rozwiązanie (TS 4.8+): `infer head extends string`.

Ta składnia działa też jako **filtr** — jeśli dopasowanie się uda, ale wywnioskowany typ nie spełni constraintu, cała gałąź daje `false` i leci do `:`. Efekt uboczny w template literalach: `infer N extends number` wymusza inferencję literału liczbowego zamiast `string`.

### Base case sam się załatwia

Pierwsza wersja miała nadmiarowy warunek:

```typescript
? tail extends readonly []
  ? Record<head, U>
  : Record<head, TupleToNestedObject<tail, U>>
```

Zbędny, bo `TupleToNestedObject<[], U>` nie dopasuje się do wzorca `[infer head, ...infer tail]` i wpadnie w gałąź `:`, zwracając `U`. Rekursja sama dochodzi do tego samego wyniku.

**Wzorzec:** zanim dopiszesz jawny warunek na ostatni element, sprawdź, co zwróci wywołanie rekurencyjne na pustej krotce. Zwykle base case już to obsługuje.

### Constraint na parametrze pociąga constrainty w łańcuchu

Przy `T extends string[]` wywołanie `TupleToNestedObject<tail, U>` wymagało `...infer tail extends string[]`. Po usunięciu constraintu z `T` obie adnotacje stały się zbędne — `infer head extends string` sam filtruje wejścia.
