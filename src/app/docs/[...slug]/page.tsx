import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { allDocs } from "contentlayer/generated";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { Toc } from "@/components/toc";
import { DocBody } from "@/components/doc-body";
import { navigation, extractToc } from "@/lib/docs";

interface Props {
  params: Promise<{ slug: string[] }>;
}

function getDoc(slug: string[]) {
  const slugStr = slug.join("/");
  return allDocs.find((doc) => doc.slug === slugStr);
}

function getAdjacentDocs(slug: string[]) {
  const currentPath = `/docs/${slug.join("/")}`;
  const allItems = navigation.flatMap((s) => s.items);
  const currentIdx = allItems.findIndex((item) => item.href === currentPath);
  return {
    prev: currentIdx > 0 ? allItems[currentIdx - 1] : null,
    next: currentIdx < allItems.length - 1 ? allItems[currentIdx + 1] : null,
  };
}

export async function generateStaticParams() {
  return allDocs.map((doc) => ({ slug: doc.slugAsParams }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const currentPath = `/docs/${slug.join("/")}`;
  const toc = extractToc(doc.body.html);
  const { prev, next } = getAdjacentDocs(slug);
  const section = navigation.find((s) =>
    s.items.some((item) => item.href === currentPath)
  );

  return (
    <div className="min-h-screen">
      <Header currentPath={currentPath} />
      <div className="flex">
        <Sidebar currentPath={currentPath} />

        <main className="flex-1 min-w-0 px-6 py-8 lg:px-10 xl:pr-6">
          <div className="max-w-3xl mx-auto">
            {section && (
              <nav className="flex items-center gap-2 mb-6 text-xs text-[var(--muted-foreground)]">
                <Link href="/" className="hover:text-[var(--foreground)] transition-colors">Docs</Link>
                <span>/</span>
                <span>{section.title}</span>
                <span>/</span>
                <span className="text-[var(--foreground)]">{doc.title}</span>
              </nav>
            )}

            <div className="mb-8 pb-6 border-b border-[var(--border)]">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)] mb-2 leading-tight">
                {doc.title}
              </h1>
              {doc.description && (
                <p className="text-base text-[var(--muted-foreground)] leading-relaxed">
                  {doc.description}
                </p>
              )}
              {"status" in doc && doc.status && (
                <span className="inline-flex mt-3 items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]">
                  {doc.status}
                </span>
              )}
            </div>

            <DocBody html={doc.body.html} />

            {(prev || next) && (
              <div className="mt-12 pt-6 border-t border-[var(--border)] flex items-center justify-between gap-4">
                {prev ? (
                  <Link
                    href={prev.href}
                    className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--border)] hover:border-[var(--foreground)]/25 hover:bg-[var(--muted)] transition-all text-sm group min-w-0"
                  >
                    <ChevronLeft size={15} className="shrink-0 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
                    <span className="truncate text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">{prev.title}</span>
                  </Link>
                ) : <div />}
                {next ? (
                  <Link
                    href={next.href}
                    className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--border)] hover:border-[var(--foreground)]/25 hover:bg-[var(--muted)] transition-all text-sm group min-w-0 text-right ml-auto"
                  >
                    <span className="truncate text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">{next.title}</span>
                    <ChevronRight size={15} className="shrink-0 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
                  </Link>
                ) : <div />}
              </div>
            )}
          </div>
        </main>

        <Toc items={toc} />
      </div>
    </div>
  );
}
