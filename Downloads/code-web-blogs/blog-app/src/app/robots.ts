import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/settings/', '/posts/new', '/posts/edit/', '/audit-logs/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
