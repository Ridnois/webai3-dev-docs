---
title: UI Standardization Backlog
description: Repeated UI patterns across webai3_web that should be extracted into shared components for consistency and reduced duplication.
section: Developer Reference
order: 10
---

This document tracks duplicated UI segments in `webai3_web` that should be consolidated into shared components. Each entry lists the pattern, where it repeats, what varies between instances, and the proposed component API.

Items are ordered by impact (file count x similarity).

---

## Already standardized

These patterns were consolidated in the March 2026 unified output system:

| Pattern | Component | Location |
|---|---|---|
| Output rendering (text/image/audio) | `OutputView` | `src/components/output/output-view.tsx` |
| Fullscreen media viewer | `OutputLightbox` | `src/components/output/output-lightbox.tsx` |
| Share / download / visibility actions | `OutputActions` | `src/components/output/output-actions.tsx` |
| Normalized output type + adapters | `OutputItem` | `src/types/output-item.ts` |
| Task icons, labels, time helpers | `output-constants` | `src/lib/output-constants.ts` |
| Connect wallet + SIWE in one click | `ConnectSignInButton` | `src/components/auth/connect-sign-in-button.tsx` |

---

## 1. Error Alert Banner

**Priority: High** -- 7 instances, 100% identical markup

A red destructive alert for inline error messages. Every instance uses the exact same Tailwind classes.

**Current duplication:**

| File | Line |
|---|---|
| `components/history/inference-history.tsx` | 56 |
| `components/inference/inference-result.tsx` | 55 |
| `components/output/output-view.tsx` | 62 |
| `components/inference/audio-result.tsx` | 80 |
| `components/inference/image-result.tsx` | 16 |
| `components/inference/model-selector.tsx` | 77 |
| `app/history/[id]/page.tsx` | 52 |

**Identical markup:**

```tsx
<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
  {message}
</div>
```

**Proposed component:**

```tsx
// src/components/ui/error-alert.tsx
export function ErrorAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {children}
    </div>
  );
}
```

---

## 2. Page Container Shell

**Priority: High** -- 6 instances, 95% identical

A max-width centered container with responsive horizontal padding. Used as the outermost wrapper on every page.

**Current duplication:**

| File | Max width |
|---|---|
| `app/dashboard/page.tsx` | `max-w-7xl` |
| `app/admin/page.tsx` | `max-w-7xl` |
| `app/history/page.tsx` | `max-w-7xl` |
| `app/history/[id]/page.tsx` | `max-w-3xl` |
| `components/gallery/public-result-view.tsx` | `max-w-4xl` |
| `app/gallery/page.tsx` | full width (defers to GalleryGrid) |

**Common pattern:**

```tsx
<div className="mx-auto max-w-{size} px-4 py-8 sm:px-6 lg:px-8">
  {children}
</div>
```

**Proposed component:**

```tsx
// src/components/layout/page-container.tsx
type MaxWidth = "sm" | "md" | "lg" | "xl" | "3xl" | "4xl" | "7xl";

export function PageContainer({
  maxWidth = "7xl",
  className,
  children,
}: {
  maxWidth?: MaxWidth;
  className?: string;
  children: React.ReactNode;
}) { ... }
```

---

## 3. Auth Guard Screen

**Priority: High** -- 4 instances, 85% similar

A centered prompt shown when the user is not authenticated. Contains an icon, title, subtitle, and a `ConnectSignInButton`.

**Current duplication:**

| File | Title | Icon |
|---|---|---|
| `app/history/[id]/page.tsx` | "Sign in to view this inference" | `Shield` (size-10) |
| `components/history/inference-history.tsx` | "Sign in to view your history" | `Shield` (size-12) |
| `components/dashboard/user-dashboard.tsx` | "Sign in to view your dashboard" | `Shield` (size-8, inside bg circle) |
| `components/admin/admin-dashboard.tsx` | "Admin sign-in required" | none (Card layout) |

**What varies:** title text, subtitle text, icon size, outer container style (plain div vs Card).

**Proposed component:**

```tsx
// src/components/auth/auth-guard-screen.tsx
export function AuthGuardScreen({
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  card?: boolean;       // wrap in Card (admin style) vs bare div
}) { ... }
```

---

## 4. Loading Skeleton Grid

**Priority: Medium** -- 5 instances, 90% similar

Repeated skeleton placeholders shown while data loads. All use `Array.from({ length: N })` mapping to `<Skeleton />` elements.

**Current duplication:**

| File | Count | Height | Layout |
|---|---|---|---|
| `components/history/inference-history.tsx` | 3 then 5 | `h-20` | vertical stack |
| `app/history/[id]/page.tsx` | 2 | `h-8` + `h-64` | vertical |
| `components/gallery/public-result-view.tsx` | 2 | `h-8` + `h-96` | vertical |
| `components/dashboard/user-dashboard.tsx` | 8+ | mixed | grid + stack |
| `components/gallery/gallery-grid.tsx` | 8 | aspect ratios | masonry |

**Proposed approach:** Don't extract a generic skeleton component (too many layout variations). Instead, colocate skeleton components with their consumers and name them consistently (`*Skeleton` suffix). The dashboard and gallery already do this well.

---

## 5. Empty State Screen

**Priority: Medium** -- 3 instances, 80% similar

A centered message with an icon shown when a list or grid has no items.

**Current duplication:**

| File | Icon | Title |
|---|---|---|
| `components/history/inference-history.tsx` | `History` | "No inferences yet" |
| `components/gallery/gallery-grid.tsx` | none | "Nothing here yet" |
| `components/gallery/public-result-view.tsx` | `Globe` | error state (similar layout) |

**Proposed component:**

```tsx
// src/components/ui/empty-state.tsx
export function EmptyState({
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;  // optional CTA button
}) { ... }
```

---

## 6. Back Button Header

**Priority: Medium** -- 2 instances, 95% identical

A ghost button with left arrow linking back to a parent page. Always wrapped in a `mb-6` div.

**Current duplication:**

| File | Href | Label |
|---|---|---|
| `app/history/[id]/page.tsx` | `/history` | "Back to History" |
| `components/gallery/public-result-view.tsx` | `/gallery` | "Back to Gallery" |

**Proposed component:**

```tsx
// src/components/layout/back-button.tsx
export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <div className="mb-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={href}>
          <ArrowLeft className="size-4" />
          {label}
        </Link>
      </Button>
    </div>
  );
}
```

---

## 7. Status Badge Variant Mapping

**Priority: Low** -- 3 instances, same mapping logic

Mapping inference status strings to badge variants. Repeated in history card, output-view detail, and dashboard media grid.

**Current pattern:**

```tsx
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  succeeded: "default",
  pending: "secondary",
  failed: "destructive",
};
```

**Proposed:** Add to `output-constants.ts`:

```tsx
export const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = { ... };

// Or a component:
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>{status}</Badge>;
}
```

---

## 8. Share Toggle Toast Messages

**Priority: Low** -- 4 instances, identical toast calls

Every component that toggles visibility uses the same `toastSuccess` / `toastError` messages after `shareMutation.mutate()`.

**Current duplication:**

| File |
|---|
| `app/history/[id]/page.tsx` |
| `components/inference/inference-result.tsx` |
| `components/history/inference-history-card.tsx` |

**Identical pattern:**

```tsx
toastSuccess(
  result.isPublic ? "Shared to gallery" : "Removed from gallery",
  result.isPublic
    ? "Anyone with the link can now view this result."
    : "This result is now private and hidden from the gallery."
);
```

**Proposed:** Move into `useShareInference` hook as default callbacks, or export a `handleShareToggle` helper.

---

## 9. Pagination Controls

**Priority: Low** -- 2 instances, different interaction models

History uses Previous/Next buttons with a page indicator. Gallery uses a "Load more" infinite-append button.

| File | Mode |
|---|---|
| `components/history/inference-history.tsx` | Previous / Next with page number |
| `components/gallery/gallery-grid.tsx` | Load more (append) |

**Proposed:** These are different enough that a shared component may not be worth it. If standardizing, offer two modes:

```tsx
<Pagination mode="pages" page={page} onPageChange={setPage} hasMore={hasMore} />
<Pagination mode="load-more" onLoadMore={handleLoadMore} hasMore={hasMore} loading={loading} />
```

---

## Implementation order

When tackling this backlog, follow this sequence to maximize immediate value:

1. **Error Alert Banner** -- one-liner component, 7 files get cleaner
2. **Page Container Shell** -- wraps all pages, immediate consistency
3. **Auth Guard Screen** -- standardizes the sign-in prompt everywhere
4. **Empty State** -- small component, reduces scattered copy
5. **Back Button** -- trivial extraction, two files
6. **Status Badge** -- add to output-constants, import where needed
7. **Share Toast Messages** -- move into the hook
8. **Pagination** -- only if more paginated views are added
9. **Skeleton layouts** -- keep colocated, just enforce naming convention
