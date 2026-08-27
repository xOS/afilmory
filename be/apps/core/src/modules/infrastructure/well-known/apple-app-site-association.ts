export const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    details: [
      {
        appIDs: ['KAMM5N88X3.app.afilmory'],
        components: [
          { '/': '/photos' },
          { '/': '/map' },
          { '/': '/explore' },
          { '/': '/studio' },
          { '/': '/studio/*' },
        ],
      },
    ],
  },
  webcredentials: {
    apps: ['KAMM5N88X3.app.afilmory'],
  },
} as const

export function appleAppSiteAssociationResponse(): Response {
  return new Response(JSON.stringify(APPLE_APP_SITE_ASSOCIATION), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  })
}
