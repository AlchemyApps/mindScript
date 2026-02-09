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
// TODO: Wire up actual component paths when code-splitting is implemented
export function preloadRouteComponents(_routeName: string): void {
  // No-op: component paths need to be configured per route
}

// Intersection Observer for lazy loading on scroll
export function useLazyLoadOnScroll(
  ref: React.RefObject<HTMLElement>,
  onIntersect: () => void,
  options?: IntersectionObserverInit
): (() => void) | undefined {
  if (typeof window === 'undefined') return undefined;

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