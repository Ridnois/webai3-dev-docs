import Link from "next/link";
import { cn } from "@/lib/utils";
import { navigation } from "@/lib/docs";

interface SidebarProps {
  currentPath: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] py-6 px-3">
      <nav className="space-y-6 flex-1">
        {navigation.map((section) => (
          <div key={section.title}>
            <p className="section-label mb-2 px-2">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn("nav-item", currentPath === item.href && "active")}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="pt-4 border-t border-[var(--sidebar-border)] mt-4">
        <p className="text-[0.7rem] text-[var(--muted-foreground)] px-2 font-mono">
          Internal — do not share
        </p>
      </div>
    </aside>
  );
}
