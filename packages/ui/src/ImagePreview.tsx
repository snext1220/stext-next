import { useEffect, useRef, useState, type ReactEventHandler } from 'react';

export interface ImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  triggerClassName?: string;
  width?: number;
  height?: number;
  loading?: 'eager' | 'lazy';
  onError?: ReactEventHandler<HTMLImageElement>;
}

/** 画像をクリックすると、原寸で拡大表示する */
export function ImagePreview({
  src,
  alt,
  className,
  triggerClassName,
  width,
  height,
  loading = 'lazy',
  onError,
}: ImagePreviewProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    setOpen(false);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const requestClose = () => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      close();
      return;
    }
    setClosing(true);
    closeTimerRef.current = setTimeout(close, 250);
  };

  return (
    <>
      <button
        type="button"
        className={`image-preview-trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
        aria-label={alt ? `${alt}を拡大表示` : '画像を拡大表示'}
        onClick={(event) => {
          event.stopPropagation();
          setClosing(false);
          setOpen(true);
        }}
      >
        <img
          src={src}
          alt={alt}
          className={className}
          width={width}
          height={height}
          loading={loading}
          onError={onError}
        />
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          className="image-preview"
          data-closing={closing || undefined}
          aria-label={alt ? `${alt}（拡大表示）` : '画像の拡大表示'}
          onClose={() => {
            if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
            setOpen(false);
          }}
          onCancel={(event) => {
            event.preventDefault();
            requestClose();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) requestClose();
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            className="image-preview-close"
            aria-label="画像を閉じる"
            onClick={requestClose}
          >
            ×
          </button>
          <div className="image-preview-content">
            <img src={src} alt={alt} />
          </div>
        </dialog>
      )}
    </>
  );
}
