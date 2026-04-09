export const PWA_MANIFEST = {
  name: 'VESTAr — K-pop Fan Voting',
  short_name: 'VESTAr',
  theme_color: '#7140FF',
  background_color: '#090A0B',
  display: 'standalone',
  orientation: 'portrait',
  scope_prod: '/vote/',
  start_url_prod: '/vote/',
} as const

export const NETLIFY_REDIRECT_RULES = [
  '/vote/verification/* /vote/verification/index.html  200',
  '/vote/* /vote/index.html  200',
  '/  /vote  301',
] as const

export function getPwaBaseUrl(isProduction: boolean): string {
  return isProduction ? '/vote/' : '/'
}

/** Returns true if the navigateFallback path is reachable under the given scope */
export function isNavigateFallbackInScope(fallback: string, scope: string): boolean {
  return fallback.startsWith(scope) || scope === '/'
}
