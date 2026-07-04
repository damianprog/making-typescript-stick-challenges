export interface DataEntity {
  id: string;
}
export interface Movie extends DataEntity {
  director: string;
}
export interface Song extends DataEntity {
  singer: string;
}

export type DataEntityMap = {
  movie: Movie;
  song: Song;
};

export type GetEntityMethods = {
  [K in keyof DataEntityMap as `get${Capitalize<K>}`]: (
    name: string,
  ) => DataEntityMap[K] | undefined;
};

export type GetAllEntitiesMethods = {
  [K in keyof DataEntityMap as `getAll${Capitalize<K>}s`]: () => DataEntityMap[K][];
};

export type AddEntityMethods = {
  [K in keyof DataEntityMap as `add${Capitalize<K>}`]: (
    entity: DataEntityMap[K],
  ) => void;
};

export type ClearEntitiesMethods = {
  [K in keyof DataEntityMap as `clear${Capitalize<K>}s`]: () => void;
};

export type AllDataMethods = GetEntityMethods &
  GetAllEntitiesMethods &
  AddEntityMethods &
  ClearEntitiesMethods;

export class DataStore implements AllDataMethods {
  #movies: { [id: string]: Movie };
  #songs: { [id: string]: Song };

  constructor() {
    this.#movies = {};
    this.#songs = {};
  }

  addMovie(movie: Movie): void {
    this.#movies = { ...this.#movies, [movie.id]: movie };
  }

  getMovie(id: Movie["id"]): Movie | undefined {
    return this.#movies[id];
  }

  getAllMovies(): Movie[] {
    return Object.values(this.#movies);
  }

  clearMovies() {
    this.#movies = {};
  }

  addSong(song: Song): void {
    this.#songs = { ...this.#songs, [song.id]: song };
  }

  getSong(id: Song["id"]): Song | undefined {
    return this.#songs[id];
  }

  getAllSongs(): Song[] {
    return Object.values(this.#songs);
  }

  clearSongs() {
    this.#songs = {};
  }
}
