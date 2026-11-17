/**
 * Wire helpers for the /api/git-sidebar JSON API: bounded body reading, response
 * writing, and the shared error envelope. Every API method returns
 * `{ok: true, value}` on success and `{ok: false, error: {code, message}}`
 * (HTTP 4xx/5xx matching the code) on failure.
 */
/** Machine-readable error codes of the sidebar API. */
export type SidebarErrorCode = 'bad-request' | 'not-found' | 'forbidden' | 'method-error' | 'fs-error' | 'git-error' | 'internal';
/** One API failure with its wire code and HTTP status. */
export declare class SidebarError extends Error {
    readonly code: SidebarErrorCode;
    readonly status: number;
    constructor(code: SidebarErrorCode, message: string, status?: number);
}
/** Success envelope of one API method. */
export interface SidebarOk<T> {
    ok: true;
    value: T;
}
/** Failure envelope of one API method. */
export interface SidebarErr {
    ok: false;
    error: {
        code: SidebarErrorCode;
        message: string;
    };
}
/** Read and parse the JSON request body (bounded; malformed → bad-request). */
export declare function readJsonBody(request: Request): Promise<unknown>;
/** Build the success envelope. */
export declare function okResponse(value: unknown): Response;
/** Build the failure envelope for any thrown value (unknown → internal 500). */
export declare function errorResponse(error: unknown): Response;
/** Narrow an unknown payload value to a string, else throw bad-request. */
export declare function requireString(payload: unknown, key: string): string;
