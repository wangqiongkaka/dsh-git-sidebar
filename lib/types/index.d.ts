import Schema from 'schemastery';
import type { Context } from './context-types.ts';
export declare const name = "dsh-git-sidebar";
export declare const inject: {
    sessions: {
        required: boolean;
    };
    agents: {
        required: boolean;
    };
    connection: {
        required: boolean;
    };
    workingDirectory: {
        required: boolean;
    };
};
export declare const Config: Schema<Schemastery.ObjectS<{
    readLimit: Schema<number, number>;
}>, Schemastery.ObjectT<{
    readLimit: Schema<number, number>;
}>>;
/** Reject exactly what `git check-ref-format` rejects for a tag name. The name
 *  reaches the host over the wire, so a leading `-` would otherwise be parsed
 *  as a git option; the rest keeps the failure at the wire edge instead of as
 *  an opaque git error. */
export declare function requireTagName(payload: unknown): string;
export declare function buildApi(ctx: Context, readLimit: number): Record<string, (payload: unknown) => Promise<unknown>>;
export declare function apply(ctx: Context, config: {
    readLimit: number;
}): void;
