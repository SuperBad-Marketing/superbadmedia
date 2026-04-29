import { Suspense } from "react";
import { RundownEntryClient } from "./rundown-entry-client";

export default function RundownPage() {
  return (
    <Suspense>
      <RundownEntryClient />
    </Suspense>
  );
}
