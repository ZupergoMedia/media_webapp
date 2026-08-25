"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
}

/**
 * Asset image gallery.
 *
 * Photos are the primary evidence an advertiser has that a site is real and
 * worth six figures, so they lead the page and open full-screen. Keyboard
 * navigation (arrows, Escape) is supported because the lightbox traps focus.
 */
export function ImageGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const go = useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((current) => {
        const next = current + direction;
        if (next < 0) return images.length - 1;
        if (next >= images.length) return 0;
        return next;
      });
    },
    [images.length],
  );

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };

    window.addEventListener("keydown", onKey);
    // Prevent the page behind the lightbox from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightboxOpen, go]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-card border border-border bg-surface-sunken text-sm text-subtle-foreground">
        No photos provided
      </div>
    );
  }

  const active = images[activeIndex];

  return (
    <>
      <div className="space-y-2">
        <div className="group relative aspect-[16/9] overflow-hidden rounded-card bg-surface-sunken">
          <Image
            src={active.url}
            alt={active.alt ?? title}
            fill
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
            priority
          />

          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-control bg-surface/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-[2px] transition-opacity hover:bg-surface"
          >
            <Expand className="size-3.5" aria-hidden="true" />
            View all {images.length}
          </button>

          {images.length > 1 && (
            <>
              <GalleryArrow direction="prev" onClick={() => go(-1)} />
              <GalleryArrow direction="next" onClick={() => go(1)} />
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`View photo ${index + 1}`}
                aria-current={index === activeIndex}
                className={cn(
                  "relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-control border-2 transition-colors",
                  index === activeIndex
                    ? "border-foreground"
                    : "border-transparent hover:border-border-strong",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photos`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close gallery"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>

          <div
            className="relative h-full max-h-[82vh] w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={active.url}
              alt={active.alt ?? title}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {images.length > 1 && (
            <>
              <GalleryArrow
                direction="prev"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                variant="lightbox"
              />
              <GalleryArrow
                direction="next"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                variant="lightbox"
              />
              <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                {activeIndex + 1} / {images.length}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}

function GalleryArrow({
  direction,
  onClick,
  variant = "inline",
}: {
  direction: "prev" | "next";
  onClick: (event: React.MouseEvent) => void;
  variant?: "inline" | "lightbox";
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-full p-2 transition-all",
        direction === "prev" ? "left-3" : "right-3",
        variant === "inline"
          ? "bg-surface/90 opacity-0 shadow-sm backdrop-blur-[2px] group-hover:opacity-100 focus-visible:opacity-100"
          : "bg-white/10 text-white hover:bg-white/20",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
