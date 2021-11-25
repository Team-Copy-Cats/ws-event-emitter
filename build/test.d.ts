declare var functionList: ((allow: () => void) => void)[];
declare function parseFunctionList(list: string | any[], allowed: {
    (): void;
    (): void;
}, i?: number): boolean;
