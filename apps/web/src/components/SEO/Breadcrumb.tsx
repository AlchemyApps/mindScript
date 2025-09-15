'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { BreadcrumbJsonLd } from './JsonLd';

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
  showSchema?: boolean;
}

/**
 * Breadcrumb navigation component with Schema.org structured data
 */
export function Breadcrumb({
  items,
  className = '',
  separator,
  showSchema = true,
}: BreadcrumbProps) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mindscript.app';

  // Convert relative URLs to absolute for schema
  const schemaItems = items.map(item => ({
    name: item.name,
    url: item.url ? (item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`) : undefined,
  }));

  return (
    <>
      {showSchema && <BreadcrumbJsonLd items={schemaItems} />}
      <nav
        className={`flex ${className}`}
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center space-x-2">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const Separator = separator || (
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
            );

            return (
              <li key={index} className="flex items-center">
                {index > 0 && <span className="mx-2">{Separator}</span>}
                {isLast || !item.url ? (
                  <span
                    className={`text-sm ${
                      isLast ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.url}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * Generate breadcrumb items from a URL path
 */
export function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', url: '/' },
  ];

  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Handle special cases
    if (segment === 'u' && segments[i + 1]) {
      // User profile path
      const username = segments[i + 1];
      breadcrumbs.push({
        name: 'Creators',
        url: '/marketplace',
      });
      breadcrumbs.push({
        name: `@${username}`,
        url: `/u/${username}`,
      });
      i++; // Skip the username segment
      currentPath = `/u/${username}`;
    } else if (segment === 'marketplace') {
      breadcrumbs.push({
        name: 'Marketplace',
        url: '/marketplace',
      });
    } else if (segment === 'category' && segments[i + 1]) {
      const category = segments[i + 1];
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      breadcrumbs.push({
        name: categoryName,
        url: `/marketplace/category/${category}`,
      });
      i++; // Skip the category segment
      currentPath = `/marketplace/category/${category}`;
    } else if (segment === 'playlists') {
      breadcrumbs.push({
        name: 'Playlists',
        url: '/playlists',
      });
    } else if (segment === 'auth') {
      breadcrumbs.push({
        name: 'Authentication',
        url: undefined, // No link for auth pages
      });
      if (segments[i + 1] === 'login') {
        breadcrumbs.push({
          name: 'Login',
          url: undefined,
        });
        i++;
      } else if (segments[i + 1] === 'signup') {
        breadcrumbs.push({
          name: 'Sign Up',
          url: undefined,
        });
        i++;
      }
    } else if (segment === 'dashboard') {
      breadcrumbs.push({
        name: 'Dashboard',
        url: '/dashboard',
      });
    } else {
      // Generic segment - capitalize first letter
      const name = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      breadcrumbs.push({
        name,
        url: i === segments.length - 1 ? undefined : currentPath,
      });
    }
  }

  return breadcrumbs;
}

/**
 * Hook to use breadcrumbs based on current pathname
 */
export function useBreadcrumbs(customItems?: BreadcrumbItem[]): BreadcrumbItem[] {
  const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbItem[]>([]);

  React.useEffect(() => {
    if (customItems) {
      setBreadcrumbs(customItems);
    } else if (typeof window !== 'undefined') {
      const items = generateBreadcrumbsFromPath(window.location.pathname);
      setBreadcrumbs(items);
    }
  }, [customItems]);

  return breadcrumbs;
}