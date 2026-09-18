import { api } from '../lib/api.js';

/** Uma notícia como o bloco da entrada a recebe. */
export interface NewsItem {
    id: string;
    sourceName: string;
    title: string;
    excerpt: string | null;
    url: string;
    imageUrl: string | null;
    publishedAt: string;
}

export const listNews = (): Promise<NewsItem[]> => api<NewsItem[]>('/news');
