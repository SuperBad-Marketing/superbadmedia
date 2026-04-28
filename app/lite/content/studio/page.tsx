import { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ContentTabs } from "../_components/content-tabs";
import { StudioClientUnified } from "./_components/studio-client-unified";

export const metadata: Metadata = {
  title: "Content Studio — SuperBad",
};

export default async function ContentStudioPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  return (
    <>
      <ContentTabs currentPath="/lite/content/studio" />
      <StudioClientUnified />
    </>
  );
}
