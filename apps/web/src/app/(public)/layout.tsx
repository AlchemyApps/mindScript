import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/components/navigation/Footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#F5F3FF] via-[#EDE9FE] to-[#F0FDFA]">
      {/* Simplified header for legal pages */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-soft-lavender/30">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="relative w-9 h-9 transition-transform duration-300 group-hover:scale-105">
                <Image
                  src="/images/logo-original.png"
                  alt="MindScript"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-lg font-semibold font-heading text-text">
                MindScript
              </span>
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Back to MindScript
            </Link>
          </div>
        </div>
      </header>

      {/* Content area */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 max-w-3xl">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg shadow-primary/5 p-6 sm:p-10">
            {children}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
