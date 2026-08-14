export * from './directory/types.js'
export * from './directory/policy.js'
export * from './directory/observations.js'
export * from './directory/merge.js'

/**
 * Cordis loads the package root to discover this package's web client.
 * The host service stays isolated behind the explicit `loongport/host` subpath.
 */
export function apply(): void {}
