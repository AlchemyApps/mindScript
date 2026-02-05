'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@mindscript/ui';
import { cn } from '../../lib/utils';
import { Heart, Send, Twitter, Instagram, Youtube } from 'lucide-react';

interface FooterProps {
  className?: string;
}

const FOOTER_LINKS = {
  create: [
    { label: 'Builder', href: '/#builder' },
    { label: 'Templates', href: '/templates' },
    { label: 'Voice Library', href: '/voices' },
    { label: 'Pricing', href: '/pricing' },
  ],
  discover: [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Featured Tracks', href: '/marketplace?filter=featured' },
    { label: 'New Releases', href: '/marketplace?filter=new' },
    { label: 'Creators', href: '/creators' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Contact', href: '/contact' },
  ],
  support: [
    { label: 'Help Center', href: '/help' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};

const SOCIAL_LINKS = [
  { icon: Twitter, href: 'https://twitter.com/mindscript', label: 'Twitter' },
  { icon: Instagram, href: 'https://instagram.com/mindscript', label: 'Instagram' },
  { icon: Youtube, href: 'https://youtube.com/mindscript', label: 'YouTube' },
];

export function Footer({ className }: FooterProps) {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      // In production, this would call your newsletter API
      setIsSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className={cn('bg-soft-lavender/20 border-t border-soft-lavender/30', className)}>
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-12">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="relative w-10 h-10">
                <Image
                  src="/images/logo.png"
                  alt="MindScript"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-semibold font-heading text-text">MindScript</span>
            </Link>

            <p className="text-muted text-sm leading-relaxed mb-6 max-w-xs">
              Transform your mindset with personalized affirmation audio. AI-powered voices,
              healing frequencies, and ambient soundscapes for your daily practice.
            </p>

            {/* Newsletter Signup */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text">Stay in the flow</p>
              {isSubscribed ? (
                <div className="flex items-center gap-2 text-sm text-accent">
                  <Heart className="w-4 h-4" />
                  <span>Thanks for subscribing!</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={cn(
                      'flex-1 px-3 py-2 text-sm rounded-lg',
                      'bg-white border border-gray-200',
                      'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10',
                      'placeholder:text-muted/50'
                    )}
                    required
                  />
                  <Button type="submit" size="sm" className="px-3">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="font-semibold text-text mb-4">Create</h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.create.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-text mb-4">Discover</h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.discover.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-text mb-4">Company</h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-text mb-4">Support</h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.support.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-soft-lavender/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted">
              © {new Date().getFullYear()} MindScript. All rights reserved.
            </p>

            {/* Social Links */}
            <div className="flex items-center gap-4">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full text-muted hover:text-primary hover:bg-white/50 transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            <p className="text-xs text-muted/70 flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-error" /> for mindful creators
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
