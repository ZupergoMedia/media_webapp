"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Uploads one or more image files straight to Vercel Blob and reports the
 * resulting URLs.
 *
 * The browser uploads directly to Blob — `/api/owner/uploads` only authorises
 * it and never receives the bytes, so multi-megabyte photos do not have to
 * fit inside a serverless request body.
 *
 * Callers stay responsible for what happens to the URLs: this component does
 * not touch the database. A partner who uploads then abandons the form leaves
 * an unreferenced blob rather than a broken AssetImage row, which is the
 * cheaper failure to clean up.
 */
export function ImageUploader({
  onUploaded,
  disabled,
  /** Stops the picker accepting more files than the form can hold. */
  remainingSlots,
}: {
  onUploaded: (urls: string[]) => void;
  disabled?: boolean;
  remainingSlots?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atCapacity = remainingSlots !== undefined && remainingSlots <= 0;

  const handleFiles = async (files: FileList) => {
    setError(null);

    let chosen = Array.from(files);
    if (remainingSlots !== undefined && chosen.length > remainingSlots) {
      chosen = chosen.slice(0, remainingSlots);
      setError(`Only ${remainingSlots} more photo(s) can be added.`);
    }
    if (chosen.length === 0) return;

    setBusy(true);
    try {
      const uploaded = await Promise.all(
        chosen.map((file) =>
          upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/owner/uploads",
          }),
        ),
      );
      onUploaded(uploaded.map((blob) => blob.url));
    } catch (uploadError) {
      // The route returns one message for auth, type and size failures alike.
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload. Please try again.",
      );
    } finally {
      setBusy(false);
      // Clears the input so re-picking the same file fires onChange again.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
        }}
      />

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || busy || atCapacity}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="size-4" aria-hidden="true" />
        )}
        {busy ? "Uploading…" : "Upload photos"}
      </Button>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}

      <p className="mt-1.5 flex items-center gap-1 text-xs text-subtle-foreground">
        <ImagePlus className="size-3 shrink-0" aria-hidden="true" />
        JPEG, PNG, WebP or AVIF, up to 8&nbsp;MB each.
      </p>
    </div>
  );
}
