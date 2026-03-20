"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation } from "@/lib/docs";

interface SearchItem {
  section: string;
  title: string;
  href: string;
}

const searchIndex: SearchItem[] = navigation.flatMap((section) =>
  section.items.map((item) => ({
    section: section.title,
    title: item.title,
    href: item.href,
  }))
);

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-[var(--foreground)] text-[var(--background)] rounded px-[1px]">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = query.trim()
    ? searchIndex.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.section.toLowerCase().includes(query.toLowerCase())
      )
    : searchIndex;

  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const navigate = useCallback(
    (href: string) => { router.push(href); onClose(); },
    [router, onClose]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIdx]) navigate(results[activeIdx].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--popover)] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Search size={16} className="shrink-0 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search dev docs…"
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <ul className="max-h-[min(380px,60vh)] overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              No results for &ldquo;{query}&rdquo;
            </li>
          ) : (
            results.map((item, i) => (
              <li key={item.href}>
                <button
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "w-full flex flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors",
                    i === activeIdx ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--foreground)]"
                  )}
                >
                  <span className="text-[0.67rem] font-mono font-semibold tracking-widest uppercase text-[var(--muted-foreground)]">
                    {item.section}
                  </span>
                  <span className="text-sm font-medium leading-tight">
                    <Highlight text={item.title} query={query} />
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border)] text-[0.7rem] text-[var(--muted-foreground)] font-mono">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> open</span>
          <span><kbd className="font-sans">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export function SearchButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 h-8 pl-3 pr-2 rounded-md border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]/20 transition-colors text-sm cursor-pointer"
      >
        <Search size={13} />
        <span className="text-xs">Search</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[0.65rem] font-mono border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] leading-none">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex sm:hidden items-center justify-center w-8 h-8 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
      >
        <Search size={16} />
      </button>
      <SearchDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
