'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad'> {
  fallbackSrc?: string;
  aspectRatio?: number;
  priority?: boolean;
  blur?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  className,
  fallbackSrc = '/images/placeholder.webp',
  aspectRatio,
  priority = false,
  blur = true,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        aspectRatio && `aspect-[${aspectRatio}]`,
        className
      )}
    >
      <Image
        src={imgSrc}
        alt={alt}
        className={cn(
          'transition-all duration-300',
          isLoading && blur && 'blur-md scale-105',
          !isLoading && 'blur-0 scale-100'
        )}
        onError={handleError}
        onLoad={handleLoad}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        {...props}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
      )}
    </div>
  );
}

// Responsive image component with srcset
export function ResponsiveImage({
  src,
  alt,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  ...props
}: OptimizedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      sizes={sizes}
      {...props}
    />
  );
}

// Avatar component with optimized loading
export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  className,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full', className)}
      priority={false}
      blur={false}
    />
  );
}