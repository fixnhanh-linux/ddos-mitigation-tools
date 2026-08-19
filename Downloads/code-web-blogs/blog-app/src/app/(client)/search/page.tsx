import { Suspense } from "react";
import SearchPageContent from "./SearchContent";

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto py-12 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-2xl max-w-2xl mx-auto" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 mx-auto" />
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
