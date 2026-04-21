import * as React from "react";

import { AdminShellWithNav } from "@/components/lite/admin-shell-with-nav";
import { AdminEventToasts } from "@/components/lite/admin-event-toasts";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminShellWithNav>
      <AdminEventToasts />
      {children}
    </AdminShellWithNav>
  );
}
