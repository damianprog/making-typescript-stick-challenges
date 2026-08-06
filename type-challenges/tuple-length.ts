// @errors: 2344
type Expect<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;

// ---cut---

// Implement this type
// type LengthOfTuple<T extends readonly any[]> = T["length"];
type LengthOfTuple<T> = T extends readonly any[] ? T["length"] : never;

/* 
w wersji instruktora w przypadku LengthOfTuple<string> otrzymamy never 
i będzie to rzecz resolved w ciele. 
A u mnie poprzez ograniczenie nie pozwolimy na przekazanie czegoś takiego do ciała.

Claude:
Twoja wersja to funkcja częściowa (partial). 
Dziedzina jest zawężona bramką: „nie-tablica w ogóle nie ma prawa wejść". 
LengthOfTuple<string> to błąd kompilacji w miejscu wywołania — 
TS krzyczy 2344 („type does not satisfy the constraint"). 
Zła wartość nigdy nie dociera do ciała.

Wersja instruktora to funkcja total. Przyjmuje dowolne T, 
a filtrowanie dzieje się w środku: pasuje → T["length"], 
nie pasuje → never. LengthOfTuple<string> 
kompiluje się bez błędu i cicho zwraca never.

*/

// Tests
const Fruits = ["cherry", "banana"] as const;
type cases = [
  Expect<Equal<LengthOfTuple<[1, 2, 3]>, 3>>,
  Expect<NotEqual<LengthOfTuple<[1, 2, 3]>, 2>>,
  Expect<Equal<LengthOfTuple<typeof Fruits>, 2>>,
  Expect<Equal<LengthOfTuple<[]>, 0>>,
];

/* 
Błędna wersja

jeśli funkcja oczekuje number[] to można podać jej readonly number[] ale nie na odwrót
bo jesli oczekujemy number[] i podajemy readonly number[] to podajemy to co jest 
oczekiwane plus cecha readonly.

poprawiona wersja 

jeśli funkcja oczekuje number[] to możliwe że w swoim ciele będzie mutować te tablice bo number[] 
bez readonly to typ który pozwala na mutowanie. Więc jeśli funkcja oczekuje number[] 
to możemy jej przekazać tylko number[] a jeśli oczekuje readonly number[] to możemy 
przekazać readonly number[] oraz number[] bo typ parametru mówi nam o tym arrayu 
że nie zamierzamy go mutować a number[] jeśli sie nie chce to nie trzeba go mutowac 
więc wszystko gra.

readonly wygląda jak „dodatek", a tak naprawdę odejmuje możliwości.
*/
