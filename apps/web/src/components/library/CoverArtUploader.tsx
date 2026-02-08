'use client';

import { useState, useRef, useCallback } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';

interface CoverArtUploaderProps {
  trackId: string;
  currentUrl?: string | null;
  onUploaded?: (url: string) => void;
  onRemoved?: () => void;
}

export function CoverArtUploader({ trackId, currentUrl, onUploaded, onRemoved }: CoverArtUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Use JPEG, PNG, WebP, or GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Max file size is 5MB');
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`/api/tracks/${trackId}/artwork`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { url } = await res.json();
      URL.revokeObjectURL(objectUrl);
      setPreview(url);
      onUploaded?.(url);
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setPreview(currentUrl || null);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [trackId, currentUrl, onUploaded]);

  const handleRemove = async () => {
    setError(null);
    setRemoving(true);

    try {
      const res = await fetch(`/api/tracks/${trackId}/artwork`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to remove artwork');
      }
      setPreview(null);
      onRemoved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text">Cover Art</label>

      {preview ? (
        /* Preview mode */
        <div className="relative group w-full aspect-square max-w-[200px] rounded-xl overflow-hidden border border-white/10">
          <img
            src={preview}
            alt="Cover art"
            className="w-full h-full object-cover"
          />
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              title="Replace"
            >
              <ImagePlus className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing || uploading}
              className="p-2 rounded-full bg-red-500/40 hover:bg-red-500/60 transition-colors"
              title="Remove"
            >
              {removing ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <X className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        /* Drop zone */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          disabled={uploading}
          className={`
            w-full max-w-[200px] aspect-square rounded-xl border-2 border-dashed
            flex flex-col items-center justify-center gap-2 transition-all cursor-pointer
            ${dragOver
              ? 'border-primary bg-primary/10'
              : 'border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10'
            }
            ${uploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 text-muted animate-spin" />
          ) : (
            <>
              <ImagePlus className="w-6 h-6 text-muted" />
              <span className="text-xs text-muted">Drop image or click</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onInputChange}
      />

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <p className="text-xs text-muted/60">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
    </div>
  );
}
