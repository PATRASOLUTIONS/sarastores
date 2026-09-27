/**
 * OptimizedImage Component
 * 
 * Enhanced Next.js Image component with:
 * - Automatic blur placeholder generation
 * - Lazy loading
 * - Responsive sizing
 * - Error handling with fallback
 * - Skeleton loading state
 */

'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackSrc?: string;
  showSkeleton?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'landscape' | 'auto';
  containerClassName?: string;
  skeletonClassName?: string;
}

// Default fallback image
const DEFAULT_FALLBACK = '/images/placeholder-product.png';

// Simple blur data URL generator
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f3f4f6" offset="20%" />
      <stop stop-color="#e5e7eb" offset="50%" />
      <stop stop-color="#f3f4f6" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f3f4f6" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

// Aspect ratio classes
const aspectRatioClasses = {
  square: 'aspect-square',
  video: 'aspect-video',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  auto: '',
};

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  showSkeleton = true,
  aspectRatio = 'auto',
  containerClassName,
  skeletonClassName,
  className,
  width,
  height,
  fill,
  priority = false,
  sizes,
  quality = 75,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  }, [currentSrc, fallbackSrc]);

  // Generate blur placeholder
  const blurDataURL = `data:image/svg+xml;base64,${toBase64(
    shimmer(Number(width) || 400, Number(height) || 400)
  )}`;

  // Default sizes for responsive images
  const defaultSizes = sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        aspectRatioClasses[aspectRatio],
        containerClassName
      )}
    >
      {/* Skeleton loader */}
      {showSkeleton && isLoading && (
        <div
          className={cn(
            'absolute inset-0 bg-gray-200 animate-pulse',
            skeletonClassName
          )}
        />
      )}

      <Image
        src={hasError ? fallbackSrc : currentSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        quality={quality}
        sizes={defaultSizes}
        placeholder="blur"
        blurDataURL={blurDataURL}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        {...props}
      />
    </div>
  );
}

/**
 * Product Image Component
 * Pre-configured for product images with hover zoom effect
 */
export function ProductImage({
  src,
  alt,
  className,
  showHoverZoom = true,
  ...props
}: OptimizedImageProps & { showHoverZoom?: boolean }) {
  return (
    <div className={cn('group relative overflow-hidden', className)}>
      <OptimizedImage
        src={src}
        alt={alt}
        aspectRatio="square"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={cn(
          'object-cover w-full h-full',
          showHoverZoom && 'transition-transform duration-300 group-hover:scale-105'
        )}
        {...props}
      />
    </div>
  );
}

/**
 * Avatar Image Component
 * Pre-configured for user avatars
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  className,
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height'> & { size?: number }) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full object-cover', className)}
      fallbackSrc="/images/default-avatar.png"
      {...props}
    />
  );
}

/**
 * Banner Image Component
 * Pre-configured for hero banners with priority loading
 */
export function BannerImage({
  src,
  alt,
  className,
  ...props
}: OptimizedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      priority
      quality={85}
      sizes="100vw"
      className={cn('object-cover', className)}
      {...props}
    />
  );
}

/**
 * Thumbnail Image Component
 * Small, optimized thumbnails for galleries
 */
export function ThumbnailImage({
  src,
  alt,
  isActive = false,
  onClick,
  className,
  ...props
}: OptimizedImageProps & { isActive?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-16 h-16 rounded-md overflow-hidden border-2 transition-colors',
        isActive ? 'border-primary' : 'border-transparent hover:border-gray-300',
        className
      )}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        sizes="64px"
        quality={60}
        className="object-cover"
        showSkeleton={false}
        {...props}
      />
    </button>
  );
}

export default OptimizedImage;
