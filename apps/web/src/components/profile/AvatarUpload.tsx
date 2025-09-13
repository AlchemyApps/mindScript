'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@mindscript/ui';
import { toast } from 'sonner';
import { Upload, X, User, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onAvatarChange: (url: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, onAvatarChange }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setImageError(false);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload avatar');
      }

      const data = await response.json();
      onAvatarChange(data.avatar_url);
      setPreviewUrl(data.avatar_url);
      toast.success('Avatar uploaded successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar');
      // Reset preview on error
      setPreviewUrl(currentAvatarUrl || null);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!currentAvatarUrl) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete avatar');
      }

      onAvatarChange('');
      setPreviewUrl(null);
      toast.success('Avatar deleted successfully');
    } catch (error) {
      console.error('Avatar delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete avatar');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {/* Avatar preview */}
        <div className="relative h-24 w-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
          {previewUrl && !imageError ? (
            <>
              <Image
                src={previewUrl}
                alt="Avatar preview"
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
              {(isUploading || isDeleting) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </>
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <User className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>

        {/* Upload controls */}
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isDeleting}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Photo
            </Button>
            
            {currentAvatarUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isUploading || isDeleting}
              >
                <X className="mr-2 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          
          <p className="text-sm text-gray-500">
            Recommended: Square image, at least 256x256px
          </p>
          <p className="text-sm text-gray-500">
            Max file size: 5MB. Supported formats: JPEG, PNG, WebP, GIF
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading || isDeleting}
      />
    </div>
  );
}