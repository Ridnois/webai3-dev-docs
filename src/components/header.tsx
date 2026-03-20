import Link from "next/link";
import { Lock } from "lucide-react";
import { getSession } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";
import { SearchButton } from "@/components/search";

interface HeaderProps {
  currentPath: string;
}

export async function Header({ currentPath }: HeaderProps) {
  void currentPath;
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-md">
      <div className="flex h-14 items-center px-4 lg:px-6 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--foreground)]">
            <Lock size={12} className="text-[var(--background)]" />
          </div>
          <span className="font-semibold text-[0.9rem] text-[var(--foreground)] hidden sm:block">
            WebAI3
          </span>
          <span className="text-[0.625rem] font-mono font-semibold px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] tracking-wider uppercase hidden sm:block">
            Dev Docs
          </span>
        </Link>

        {/* Search */}
        <SearchButton />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: address + logout */}
        <div className="flex items-center gap-2">
          {session?.address && (
            <span className="hidden sm:block text-xs font-mono text-[var(--muted-foreground)] px-2 py-1 rounded bg-[var(--muted)] border border-[var(--border)]">
              {session.address.slice(0, 6)}…{session.address.slice(-4)}
            </span>
          )}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
