import { type Accessor, type Setter } from 'solid-js';
export type PersistedOptions<T> = {
    /** во что превращать значение; по умолчанию JSON */
    stringify?: (value: T) => string;
    /** как читать сохранённое; вернул undefined — берём начальное */
    parse?: (raw: string) => T | undefined;
    /** куда складывать; по умолчанию localStorage, а без него — никуда */
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
};
export declare function createPersisted<T>(key: string, initial: T, opts?: PersistedOptions<T>): [Accessor<T>, Setter<T>];
