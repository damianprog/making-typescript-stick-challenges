# Making TypeScript — wzorce (patterns)

Notatnik wzorców z challenge'y i realnych problemów. Każdy wpis: co robi, kluczowa idea, kod, pułapki.

---

## Wpis 1: Typed Data Store — generowanie metod z mapy encji

*Źródło: Making TypeScript Stick — Challenge 1 "Building a typed data store"*

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
    id: string
  ) => DataEntityMap[K] | undefined;   // pojedynczy lookup → może nie znaleźć
};

export type GetAllEntitiesMethods = {
  [K in keyof DataEntityMap as `getAll${Capitalize<K>}s`]: () => DataEntityMap[K][];
  // kolekcja ZAWSZE istnieje (bywa pusta) → BEZ | undefined
};

export type AddEntityMethods = {
  [K in keyof DataEntityMap as `add${Capitalize<K>}`]: (
    entity: DataEntityMap[K]
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
    this.#movies[movie.id] = movie;          // computed key: [wyrażenie]
  }
  getMovie(id: Movie["id"]): Movie | undefined {
    return this.#movies[id];                 // mapa → lookup po id w O(1)
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

| Pułapka | Źle | Dobrze |
|---|---|---|
| Mapped type w `interface` | `interface X { [K in ...] }` | tylko `type X = { [K in ...] }` |
| `type` bez `=` | `type X { ... }` | `type X = { ... }` (alias → przypisanie) |
| `getAll` z `\| undefined` | kolekcja „może nie istnieć" | kolekcja zawsze istnieje, bywa pusta → `T[]` |
| Zaszyty return | `=> Movie` na sztywno | `=> DataEntityMap[K]` (podąża za kluczem) |
| Klucz z kropką | `{ movie.id: movie }` | `{ [movie.id]: movie }` (computed key) |
| Zagnieżdżony `{}` w spreadzie | `{ ...m, { [id]: v } }` | `{ ...m, [id]: v }` |
| `private` zamiast `#` | widoczne w `Object.keys` | `#` → naprawdę znika z instancji w runtimie |

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
