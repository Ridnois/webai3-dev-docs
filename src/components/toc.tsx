interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TocProps {
  items: TocItem[];
}

export function Toc({ items }: TocProps) {
  if (items.length === 0) return null;

  return (
    <aside className="hidden xl:block w-52 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pl-4">
      <p className="section-label mb-3">On this page</p>
      <nav>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="block text-[0.8rem] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-0.5 leading-snug"
                style={{ paddingLeft: item.level === 3 ? "0.85rem" : "0" }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
