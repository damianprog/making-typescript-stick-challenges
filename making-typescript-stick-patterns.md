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
