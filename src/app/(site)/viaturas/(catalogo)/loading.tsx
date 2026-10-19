import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="pt-[calc(var(--header-offset)+3.5rem)]" aria-busy="true" aria-label="A carregar viaturas">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-12 w-64" />
        <div className="mt-16 grid gap-10 lg:grid-cols-[17rem_1fr]">
          <div className="hidden space-y-4 lg:block">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-sm border border-line">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="mt-6 h-6 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
