"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { SfxSound } from "@/lib/content-studio/motion/types";
import { addSfxAction, deleteSfxAction } from "./actions";

const UPLOAD_COLORS = [
  "#BB6BD9",
  "#F2994A",
  "#2D9CDB",
  "#E2B93B",
  "#27AE60",
  "#9B51E0",
  "#EB5757",
  "#56CCF2",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface Props {
  initialSounds: SfxSound[];
}

export function SfxLibraryAdmin({ initialSounds }: Props) {
  const [sounds, setSounds] = useState<SfxSound[]>(initialSounds);
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(UPLOAD_COLORS[0]);
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    publicId: string;
    fileName: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const customCount = sounds.filter((s) => !s.isBuiltin).length;

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Max 5 MB.");
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload/sfx", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!data.ok) {
          toast.error(data.error || "Upload failed.");
          return;
        }
        setUploadedFile({
          url: data.url,
          publicId: data.publicId,
          fileName: file.name,
        });
        if (!newName) {
          const nameFromFile = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
          setNewName(nameFromFile.charAt(0).toUpperCase() + nameFromFile.slice(1));
        }
        setNewColor(UPLOAD_COLORS[(customCount + 1) % UPLOAD_COLORS.length]);
        toast.success("File uploaded. Name it and save.");
      } catch {
        toast.error("Upload failed.");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [newName, customCount],
  );

  const handleSave = useCallback(async () => {
    if (!uploadedFile || !newName.trim()) return;

    const slug = slugify(newName);
    if (!slug) {
      toast.error("Name produces an empty slug.");
      return;
    }

    const result = await addSfxAction({
      name: newName.trim(),
      slug,
      fileUrl: uploadedFile.url,
      cloudinaryPublicId: uploadedFile.publicId,
      color: newColor,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setSounds((prev) => [
      ...prev,
      {
        id: result.id,
        name: newName.trim(),
        slug,
        fileUrl: uploadedFile.url,
        color: newColor,
        isBuiltin: false,
      },
    ]);
    setUploadedFile(null);
    setNewName("");
    toast.success(`"${newName.trim()}" added to the library.`);
  }, [uploadedFile, newName, newColor]);

  const handleDelete = useCallback(
    async (sound: SfxSound) => {
      const result = await deleteSfxAction(sound.id);
      if (!result.ok) {
        toast.error("Failed to delete.");
        return;
      }
      setSounds((prev) => prev.filter((s) => s.id !== sound.id));
      toast.success(`"${sound.name}" removed.`);
    },
    [],
  );

  const handlePreview = useCallback((sound: SfxSound) => {
    const url = sound.fileUrl.startsWith("http")
      ? sound.fileUrl
      : `/${sound.fileUrl}`;

    if (!audioRefs.current[sound.id]) {
      audioRefs.current[sound.id] = new Audio(url);
    }
    const audio = audioRefs.current[sound.id];
    audio.currentTime = 0;
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Upload section */}
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          border: "1px solid rgba(253,245,230,0.08)",
          background: "rgba(253,245,230,0.02)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(253,245,230,0.4)",
            marginBottom: 12,
          }}
        >
          Upload new sound
        </div>

        {!uploadedFile ? (
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 16px",
              borderRadius: 8,
              border: "1px dashed rgba(253,245,230,0.15)",
              background: "rgba(253,245,230,0.02)",
              cursor: uploading ? "wait" : "pointer",
              transition: "border-color 0.15s",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "rgba(253,245,230,0.5)",
                textAlign: "center",
              }}
            >
              {uploading
                ? "Uploading…"
                : "Drop a WAV, MP3, or OGG file here — or click to browse"}
            </div>
            <div
              style={{
                fontFamily: "var(--font-label)",
                fontSize: 10,
                color: "rgba(253,245,230,0.25)",
                marginTop: 6,
              }}
            >
              Max 5 MB
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="audio/wav,audio/mpeg,audio/ogg,audio/webm,.wav,.mp3,.ogg,.webm"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--color-brand-cream)",
              }}
            >
              Uploaded: {uploadedFile.fileName}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Sound name"
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(253,245,230,0.12)",
                  background: "rgba(253,245,230,0.04)",
                  color: "var(--color-brand-cream)",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  outline: "none",
                }}
              />

              <div style={{ display: "flex", gap: 3 }}>
                {UPLOAD_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: c,
                      border:
                        newColor === c
                          ? "2px solid var(--color-brand-cream)"
                          : "2px solid transparent",
                      cursor: "pointer",
                      transition: "border-color 0.1s",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={!newName.trim()}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--color-brand-red)",
                  color: "var(--color-brand-cream)",
                  fontFamily: "var(--font-label)",
                  fontSize: 11,
                  letterSpacing: 1,
                  cursor: "pointer",
                  opacity: newName.trim() ? 1 : 0.4,
                }}
              >
                Save to library
              </button>
              <button
                onClick={() => {
                  setUploadedFile(null);
                  setNewName("");
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(253,245,230,0.12)",
                  background: "transparent",
                  color: "rgba(253,245,230,0.5)",
                  fontFamily: "var(--font-label)",
                  fontSize: 11,
                  letterSpacing: 1,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sound list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sounds.map((sound) => (
          <div
            key={sound.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(253,245,230,0.06)",
              background: "rgba(253,245,230,0.02)",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: sound.color,
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-label)",
                  fontSize: 12,
                  letterSpacing: 1,
                  color: "var(--color-brand-cream)",
                }}
              >
                {sound.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  color: "rgba(253,245,230,0.3)",
                  marginTop: 1,
                }}
              >
                {sound.slug}
                {sound.isBuiltin && (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: "rgba(253,245,230,0.06)",
                      fontFamily: "var(--font-label)",
                      fontSize: 9,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: "rgba(253,245,230,0.35)",
                    }}
                  >
                    Built-in
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => handlePreview(sound)}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                border: "1px solid rgba(253,245,230,0.1)",
                background: "rgba(253,245,230,0.04)",
                color: "rgba(253,245,230,0.6)",
                fontFamily: "var(--font-label)",
                fontSize: 10,
                letterSpacing: 0.5,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Preview
            </button>

            {!sound.isBuiltin && (
              <button
                onClick={() => handleDelete(sound)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  border: "1px solid rgba(235,87,87,0.25)",
                  background: "rgba(235,87,87,0.06)",
                  color: "#EB5757",
                  fontFamily: "var(--font-label)",
                  fontSize: 10,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {sounds.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "rgba(253,245,230,0.3)",
            textAlign: "center",
            padding: 40,
          }}
        >
          No sounds in the library yet.
        </div>
      )}
    </div>
  );
}
