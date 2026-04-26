import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getCurrentPack } from "@/lib/talking-head/session-pack";
import { ContentTabs } from "../_components/content-tabs";
import { ScriptStudioClient } from "./_components/script-studio-client";

export const metadata: Metadata = {
  title: "Script Studio — SuperBad",
};

export default async function ScriptStudioPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { pack, scripts } = await getCurrentPack();

  return (
    <>
      <ContentTabs currentPath="/lite/content/script-studio" />
      <ScriptStudioClient initialPack={pack} initialScripts={scripts} />
    </>
  );
}
