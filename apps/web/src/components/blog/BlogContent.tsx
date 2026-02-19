import { cn } from '@/lib/utils';

interface BlogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function BlogContent({ children, className }: BlogContentProps) {
  return (
    <div
      className={cn(
        'max-w-3xl mx-auto',
        // Headings
        '[&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-text [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-4',
        '[&_h3]:font-heading [&_h3]:font-semibold [&_h3]:text-text [&_h3]:text-xl [&_h3]:mt-8 [&_h3]:mb-3',
        // Body text
        '[&_p]:text-muted [&_p]:leading-relaxed [&_p]:mb-4',
        // Lists
        '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-muted [&_ul]:space-y-1',
        '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:text-muted [&_ol]:space-y-1',
        '[&_li]:leading-relaxed',
        // Links
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/30 hover:[&_a]:decoration-primary',
        // Blockquote
        '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted/80 [&_blockquote]:my-6',
        // Code
        '[&_code]:bg-primary/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-primary',
        // Strong
        '[&_strong]:font-semibold [&_strong]:text-text',
        // Images
        '[&_img]:rounded-xl [&_img]:my-6',
        className
      )}
    >
      {children}
    </div>
  );
}
