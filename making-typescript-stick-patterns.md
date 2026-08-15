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
