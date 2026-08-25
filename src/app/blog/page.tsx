import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { POSTS_BY_DATE } from "@/content/blog";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides to out-of-home advertising — media formats, LED and digital screens, transit and van media, asset ownership and how the field is changing.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: "Blog · ZuperGo Media",
    description:
      "Guides to out-of-home advertising: formats, digital screens, transit media, and asset ownership.",
  },
};

export default function BlogIndexPage() {
  const [lead, ...rest] = POSTS_BY_DATE;

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Blog
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Practical guides to out-of-home advertising — what the formats do,
            how digital inventory is actually priced, and what is being
            transacted when a media asset changes hands.
          </p>
        </header>

        {/* Lead post, given more room than the rest. */}
        {lead && (
          <Link
            href={`/blog/${lead.slug}`}
            className="group mt-10 block rounded-card border border-border bg-surface p-6 transition-colors hover:border-border-strong"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-accent">
              {lead.category}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
              {lead.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{lead.summary}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle-foreground">
              <span>{formatDate(lead.publishedAt)}</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" aria-hidden="true" />
                {lead.readingMinutes} min read
              </span>
              <span className="flex items-center gap-1 font-medium text-brand">
                Read
                <ArrowRight
                  className="size-3 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </Link>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {rest.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-card border border-border bg-surface p-5 transition-colors hover:border-border-strong"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-accent">
                {post.category}
              </p>
              <h2 className="mt-2 text-base font-semibold leading-snug tracking-tight">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                {post.summary}
              </p>
              <div className="mt-auto flex items-center gap-x-3 pt-4 text-xs text-subtle-foreground">
                <span>{formatDate(post.publishedAt)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" aria-hidden="true" />
                  {post.readingMinutes} min
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
