import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    /* El titular del artículo lo lee una persona y puede ser largo; el título
       que sale en Google se corta a los ~60 caracteres. Cuando los dos no caben
       en el mismo texto, `seoTitle` gana en el <title> y `title` se queda como
       el H1 de la página. */
    seoTitle: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.enum(['retail', 'tecnologia', 'impacto', 'producto', 'general']).optional(),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { blog };
