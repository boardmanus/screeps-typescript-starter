import { LogLevels } from '../lib/logger/logLevels';
// import * as data from "../../package.json";

/**
 * Enable this if you want a lot of text to be logged to console.
 * @type {boolean}
 */
export const ENABLE_DEBUG_MODE = true;

/**
 * Enable this to enable screeps profiler
 */
export const USE_PROFILER = true;

/**
 * Minimum number of ticksToLive for a Creep before they go to renew.
 * @type {number}
 */
export const DEFAULT_MIN_LIFE_BEFORE_NEEDS_REFILL = 700;

/**
 * Debug level for log output
 */
export const LOG_LEVEL: number = LogLevels.DEBUG;

/**
 * Prepend log output with current tick number.
 */
export const LOG_PRINT_TICK = true;

/**
 * Prepend log output with source line.
 */
export const LOG_PRINT_LINES = true;

/**
 * Load source maps and resolve source lines back to typeascript.
 */
export const LOG_LOAD_SOURCE_MAP = true;

/**
 * Maximum padding for source links (for aligning log output).
 */
export const LOG_MAX_PAD = 100;

/**
 * VSC location, used to create links back to source.
 * Repo and revision are filled in at build time for git repositories.
 */
// export const LOG_VSC = { repo: "@@_repo_@@", revision: "@@_revision_@@", valid: false };
// export const LOG_VSC = { repo: "@@_repo_@@", revision: (<any>data).version, valid: false };

/**
 * URL template for VSC links, this one works for github and gitlab.
 */
export const LOG_VSC_URL_TEMPLATE = (path: string, line: string) => `vscode://file/${path}:${line}`;
  //  return `${LOG_VSC.repo}/blob/${LOG_VSC.revision}/${path}#${line}`;
