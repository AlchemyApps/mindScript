import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Builder | MindScript',
  description: 'Create personalized meditation and mindfulness audio tracks with AI voices, background music, and healing frequencies.',
  keywords: 'meditation, audio builder, AI voice, mindfulness, healing frequencies, solfeggio, binaural beats',
};

export default function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}