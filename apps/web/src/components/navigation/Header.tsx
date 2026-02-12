'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, User, LogOut } from 'lucide-react';
import { Button } from '@mindscript/ui';
import { cn } from '../../lib/utils';
import { CartButton } from '../Cart/CartButton';
import { CartDrawer } from '../Cart/CartDrawer';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';
import { usePlayerStore } from '@/store/playerStore';

interface HeaderProps {
  variant?: 'transparent' | 'solid';
  className?: string;
}

interface NavLink {
  label: string;
  href: string;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Create', href: '/builder' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Library', href: '/library' },
];

export function Header({ variant = 'transparent', className }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const pathname = usePathname();

  // Helper to get the right href for nav links
  const getNavHref = (link: NavLink) => {
    if (link.href === '/builder' && pathname === '/') {
      // Logged-in users go straight to /builder
      if (user) return '/builder';
      // Non-logged-in users stay on landing page
      return '#';
    }
    return link.href;
  };

  // Handle Create button click for non-logged-in users on landing page
  const handleNavClick = (link: NavLink, e: React.MouseEvent) => {
    if (link.href === '/builder' && pathname === '/' && !user) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.dispatchEvent(new CustomEvent('mindscript:showBuilderHint'));
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };
    checkAuth();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      usePlayerStore.getState().clearCurrentTrack();
      setUser(null);
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const showSolidHeader = variant === 'solid' || isScrolled;

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          showSolidHeader
            ? 'bg-surface/95 backdrop-blur-md border-b border-gray-100 shadow-sm'
            : 'bg-transparent',
          className
        )}
      >
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="relative w-10 h-10 transition-transform duration-300 group-hover:scale-105">
                <Image
                  src="/images/logo-original.png"
                  alt="MindScript"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className={cn(
                'text-xl font-semibold font-heading transition-colors',
                showSolidHeader ? 'text-text' : 'text-text'
              )}>
                MindScript
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={getNavHref(link)}
                  onClick={(e) => handleNavClick(link, e)}
                  className={cn(
                    'relative px-4 py-2 text-sm font-medium transition-colors rounded-lg',
                    showSolidHeader
                      ? 'text-muted hover:text-text hover:bg-gray-50'
                      : 'text-muted hover:text-text',
                    'group'
                  )}
                >
                  {link.label}
                  <span className="absolute bottom-1 left-4 right-4 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-full" />
                </Link>
              ))}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-3">
              <CartButton onClick={() => setIsCartOpen(true)} />

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={cn(
                      'flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors',
                      showSolidHeader
                        ? 'hover:bg-gray-50'
                        : 'hover:bg-white/10'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 glass rounded-xl py-2 animate-scale-in">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-text truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/profile"
                        className="flex items-center px-4 py-2 text-sm text-muted hover:text-text hover:bg-gray-50 transition-colors"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </Link>
                      <Link
                        href="/library"
                        className="flex items-center px-4 py-2 text-sm text-muted hover:text-text hover:bg-gray-50 transition-colors"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        Library
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-muted hover:text-text hover:bg-gray-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href="/auth/login">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white"
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-text" />
              ) : (
                <Menu className="w-6 h-6 text-text" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 glass border-b border-gray-100 animate-slide-up">
            <div className="container mx-auto px-4 py-4">
              <nav className="flex flex-col space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={getNavHref(link)}
                    className="px-4 py-3 text-muted hover:text-text hover:bg-gray-50 rounded-lg transition-colors"
                    onClick={(e) => {
                      handleNavClick(link, e);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <CartButton onClick={() => { setIsCartOpen(true); setIsMobileMenuOpen(false); }} />

                {user ? (
                  <div className="flex items-center space-x-3">
                    <Link href="/profile">
                      <Button variant="ghost" size="sm">Profile</Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <Link href="/auth/login">
                    <Button variant="default" size="sm">Sign In</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Dropdown backdrop */}
      {isDropdownOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </>
  );
}
