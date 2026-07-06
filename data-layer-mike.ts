export interface DataEntity {
  id: string;
}
export interface Movie extends DataEntity {
  director: string;
}
export interface Song extends DataEntity {
  singer: string;
}
// export interface Comic extends DataEntity {
//   issueNumber: number;
// }

export type DataEntityMap = {
  movie: Movie;
  song: Song;
  // comic: Comic;
};

type DataStoreMethods = {
  [K in keyof DataEntityMap as `getAll${Capitalize<K>}s`]: () => DataEntityMap[K][];
} & {
  [K in keyof DataEntityMap as `get${Capitalize<K>}`]: (
    id: string,
  ) => DataEntityMap[K];
} & {
  [K in keyof DataEntityMap as `clear${Capitalize<K>}s`]: () => void;
};

function isDefined<T>(x: T | undefined): x is T {
  return typeof x !== "undefined";
}

export class DataStore implements DataStoreMethods {
  #data: { [K in keyof DataEntityMap]: Record<string, DataEntityMap[K]> } = {
    movie: {},
    song: {},
  };

  getAllSongs(): Song[] {
    return Object.keys(this.#data.song)
      .map((songKey) => this.#data.song[songKey])
      .filter(isDefined);
  }
  getSong(): Song {}
  clearSongs(): void {}

  // getAllSongs(): Song[] {}
  // getSong(): Song {}
  // clearSongs(): void {}
}
