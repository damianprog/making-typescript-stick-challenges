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
    name: string
  ) => DataEntityMap[K] | undefined;
};

export type GetAllEntitiesMethods = {
  [K in keyof DataEntityMap as `getAll${Capitalize<K>}s`]: () => DataEntityMap[K][];
};

export type AddEntityMethods = {
  [K in keyof DataEntityMap as `add${Capitalize<K>}`]: (
    entity: DataEntityMap[K]
  ) => void;
};

export type ClearEntitiesMethods = {
  [K in keyof DataEntityMap as `clear${Capitalize<K>}s`]: () => void;
};

export type AllDataMethods = GetEntityMethods &
  GetAllEntitiesMethods &
  AddEntityMethods &
  ClearEntitiesMethods;

export class DataStore {
  movies: Movie[];
  songs: Song[];

  constructor() {
    this.movies = [];
    this.songs = [];
  }
}
