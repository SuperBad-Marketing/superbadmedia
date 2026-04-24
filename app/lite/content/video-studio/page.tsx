import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { VideoStudioClient } from "./_components/video-studio-client";

export const metadata: Metadata = {
  title: "Video Studio — SuperBad",
};

export default async function VideoStudioPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  return <VideoStudioClient />;
}
