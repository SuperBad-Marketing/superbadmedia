import * as React from "react";

import { AdminShellWithNav } from "@/components/lite/admin-shell-with-nav";

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShellWithNav>{children}</AdminShellWithNav>;
}
