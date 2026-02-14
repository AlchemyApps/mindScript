import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Builder | MindScript',
  description: 'Create personalized meditation and mindfulness audio tracks with professional voices, background music, and healing frequencies.',
  keywords: 'meditation, audio builder, professional voice, mindfulness, healing frequencies, solfeggio, binaural beats',
};

export default function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}