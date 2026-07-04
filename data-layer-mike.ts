export interface DataEntity {
  id: string;
}
export interface Movie extends DataEntity {
  director: string;
}
export interface Song extends DataEntity {
  singer: string;
}
export interface Comic extends DataEntity {
  issueNumber: number;
}

export type DataEntityMap = {
  movie: Movie;
  song: Song;
  comic: Comic;
};

type DataStoreMethods = {
  [K in keyof DataEntityMap as `getAll${Capitalize<K>}s`]: 
    () => DataEntityMap[K][];
} & {
    [K in keyof DataEntityMap as `get${Capitalize<K>}`]: 
        (id: string) => DataEntityMap[K];
} & {
    [K in keyof DataEntityMap as `clear${Capitalize<K>}s`]: 
        () => void;
} ;

export class DataStore implements DataStoreMethods {}

const ds: DataStoreMethods = {} as any;
ds.
