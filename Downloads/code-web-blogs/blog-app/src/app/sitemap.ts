import { MetadataRoute } from 'next';
import connectDB from '@/lib/mongodb';
import Post from '@/models/Post';
import Category from '@/models/Category';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  try {
    await connectDB();
    const posts = await Post.find({
      $or: [{ status: "published" }, { published: true }]
    }).select('slug updatedAt').lean();
    
    const categories = await Category.find().select('slug updatedAt').lean();

    const postUrls = posts.map((post: any) => ({
      url: `${baseUrl}/posts/${post.slug}`,
      lastModified: post.updatedAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
    
    const categoryUrls = categories.map((cat: any) => ({
      url: `${baseUrl}/categories/${cat.slug}`,
      lastModified: cat.updatedAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      },
      {
        url: `${baseUrl}/about`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.5,
      },
      ...postUrls,
      ...categoryUrls,
    ];
  } catch (error) {
    // Fallback if DB fails
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
      }
    ];
  }
}
