import type { Context } from '@deepseek-ai/cordis';
export declare const inject: string[];
/** Mount independent views; every registration is released on plugin unload. */
export declare function apply(ctx: Context): void;
