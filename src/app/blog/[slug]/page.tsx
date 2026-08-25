import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { POSTS, POSTS_BY_DATE, getPostBySlug, type BlogBlock } from "@/content/blog";
import { formatDate } from "@/lib/format";
import { appUrl } from "@/lib/env";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Posts are static content, so every route is known at build time. */
export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  // Next two posts by date, for onward reading.
  const others = POSTS_BY_DATE.filter((entry) => entry.slug !== post.slug).slice(0, 2);

  /**
   * Article structured data. Uses the paragraph text as articleBody so the
   * markup describes the same content the page renders.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.summary,
    datePublished: post.publishedAt,
    articleSection: post.category,
    author: { "@type": "Organization", name: "ZuperGo Media" },
    publisher: { "@type": "Organization", name: "ZuperGo Media" },
    mainEntityOfPage: `${appUrl}/blog/${post.slug}`,
  };

  return (
    <>
      <Navbar />

      <script
        type="application/ld+json"
        // Serialised from our own content module, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-2xl px-4 py-12 md:py-16">
        <Link
          href="/blog"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All posts
        </Link>

        <article>
          <header>
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              {post.category}
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-subtle-foreground">
              <span>{formatDate(post.publishedAt)}</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {post.readingMinutes} min read
              </span>
            </div>
          </header>

          <div className="mt-8 space-y-5">
            {post.body.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>
        </article>

        {others.length > 0 && (
          <aside className="mt-14 border-t border-border pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Keep reading
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {others.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/blog/${entry.slug}`}
                  className="group rounded-card border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-accent">
                    {entry.category}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold leading-snug">
                    {entry.title}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand">
                    Read
                    <ArrowRight
                      className="size-3 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </main>
    </>
  );
}

/**
 * Maps a content block to markup.
 *
 * Blocks are a closed union, so there is no path for arbitrary HTML to reach
 * the page — the only `dangerouslySetInnerHTML` here is the JSON-LD above,
 * built from our own data.
 */
function Block({ block }: { block: BlogBlock }) {
  switch (block.kind) {
    case "heading":
      return (
        <h2 className="pt-3 text-xl font-semibold tracking-tight">{block.text}</h2>
      );

    case "paragraph":
      return (
        <p className="text-[1.0625rem] leading-relaxed text-muted-foreground">
          {block.text}
        </p>
      );

    case "list":
      return (
        <ul className="space-y-2">
          {block.items.map((item, index) => (
            <li
              key={index}
              className="flex gap-2.5 text-[1.0625rem] leading-relaxed text-muted-foreground"
            >
              <span
                className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case "callout":
      return (
        <p className="border-l-2 border-brand bg-brand-subtle/40 py-3 pl-4 pr-3 text-[1.0625rem] font-medium leading-relaxed text-foreground">
          {block.text}
        </p>
      );
  }
}
