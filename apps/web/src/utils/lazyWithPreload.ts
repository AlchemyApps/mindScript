import { ComponentType, lazy, LazyExoticComponent } from 'react';

export interface PreloadableComponent<T extends ComponentType<any>>
  extends LazyExoticComponent<T> {
  preload: () => Promise<{ default: T }>;
}

export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  const Component = lazy(factory) as PreloadableComponent<T>;
  Component.preload = factory;
  return Component;
}

// Helper to preload multiple components
export function preloadComponents(
  components: PreloadableComponent<any>[]
): Promise<void[]> {
  return Promise.all(
    components.map((component) => component.preload().then(() => undefined))
  );
}

// Helper for route-based preloading
export function preloadRouteComponents(routeName: string): void {
  // Preload components based on route patterns
  switch (routeName) {
    case '/builder':
      // Preload builder-related components
      import('../components/builder/TrackBuilder').catch(() => {});
      import('../components/builder/ScriptEditor').catch(() => {});
      break;
    case '/library':
      // Preload library components
      import('../components/library/TrackList').catch(() => {});
      import('../components/library/AudioPlayer').catch(() => {});
      break;
    case '/marketplace':
      // Preload marketplace components
      import('../components/marketplace/SellerCard').catch(() => {});
      import('../components/marketplace/TrackCard').catch(() => {});
      break;
    default:
      break;
  }
}

// Intersection Observer for lazy loading on scroll
export function useLazyLoadOnScroll(
  ref: React.RefObject<HTMLElement>,
  onIntersect: () => void,
  options?: IntersectionObserverInit
): void {
  if (typeof window === 'undefined') return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        onIntersect();
        observer.unobserve(entry.target);
      }
    });
  }, options);

  if (ref.current) {
    observer.observe(ref.current);
  }

  return () => {
    if (ref.current) {
      observer.unobserve(ref.current);
    }
  };
}