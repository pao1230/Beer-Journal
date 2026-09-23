"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui";
import type { ActionState } from "@/lib/form";
import { useI18n } from "@/lib/i18n/client";

const MAX_EDGE = 1600;

async function resize(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not process image");
  return { blob, width, height };
}

export function PhotoUploader({ action }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {});
  const [message, setMessage] = useState<string | null>(null);
  const captionRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    for (const file of Array.from(files)) {
      try {
        const { blob, width, height } = await resize(file);
        const fd = new FormData();
        fd.set("photo", blob, file.name.replace(/\.\w+$/, "") + ".jpg");
        fd.set("width", String(width));
        fd.set("height", String(height));
        fd.set("caption", captionRef.current?.value ?? "");
        startTransition(() => formAction(fd));
      } catch {
        setMessage(t("{name}: this image format isn't supported by your browser", { name: file.name }));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    if (captionRef.current) captionRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input ref={captionRef} placeholder={t("Caption (optional)")} aria-label={t("Photo caption")} className="sm:max-w-xs" />
      <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
        <Camera className="size-4" />
        {pending ? t("Uploading…") : t("Add photos")}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={pending}
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
      {(message ?? state.error) && (
        <p role="alert" className="text-sm text-danger">
          {message ?? (state.error && t(state.error))}
        </p>
      )}
    </div>
  );
}
