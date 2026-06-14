/** Default timeout in milliseconds for running CLI processes (5 minutes). */
export const DEFAULT_TIMEOUT_MS = 300000

/** Default environment variables allowed to be forwarded to provider processes. */
export const DEFAULT_ENV_ALLOWLIST = ['PATH', 'HOME', 'NODE_OPTIONS']

/** Directory segments for locating Claude agents (e.g. `.claude/agents`). */
export const AGENT_DIR_SEGMENTS = ['.claude', 'agents']
