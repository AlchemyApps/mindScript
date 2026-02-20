import type { Metadata } from 'next';
import Link from 'next/link';
import { Mic, AudioLines, Music, Sparkles, PenTool, Download } from 'lucide-react';
import { generateMetadata as generateSeoMetadata } from '@/components/SEO/MetaTags';
import { FAQPageJsonLd, BreadcrumbJsonLd } from '@/components/SEO/JsonLd';
import { LandingFAQ } from '@/components/marketing/LandingFAQ';
import { LandingCTA } from '@/components/marketing/LandingCTA';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Custom Meditation Audio Creator | MindScript',
  description:
    'Create your own guided meditation audio with AI script assistance, voice cloning, binaural beats, solfeggio frequencies, and 20+ background music tracks. Build personalized meditation tracks in minutes.',
  keywords: [
    'custom meditation audio creator',
    'create your own guided meditation audio',
    'personalized meditation app with your own voice',
    'AI meditation script generator',
    'record your own affirmations app',
    'make your own affirmation audio track',
  ],
  url: '/custom-meditation-creator',
  type: 'website',
});

const faqItems = [
  {
    question: 'How do I create my own meditation audio?',
    answer:
      'Creating your own meditation audio with MindScript takes just a few minutes. Write or paste your script (or use AI to help generate one), choose a voice from our studio-quality AI voices or clone your own, layer in background music, binaural beats, and solfeggio frequencies, then render your track. The finished audio is available in your library for immediate playback.',
  },
  {
    question: 'Can I use my own voice?',
    answer:
      'Yes. MindScript offers voice cloning so you can record a short sample of your voice and use it for all your meditation tracks. Research in psycholinguistics suggests the brain processes self-referential speech differently than external voices, which may help affirmations feel more natural and bypass inner resistance. You can also choose from a range of studio-quality AI voices if you prefer.',
  },
  {
    question: 'What makes personalized meditation more effective than generic?',
    answer:
      'Research on tailored interventions consistently shows that personalized approaches outperform one-size-fits-all alternatives. Self-determination theory explains why: when you have autonomy over the words, voice, and soundscape of your practice, intrinsic motivation increases. Studies on self-referential processing also show the brain activates differently when hearing content that feels personally relevant, engaging the medial prefrontal cortex more strongly.',
  },
  {
    question: 'How long can my track be?',
    answer:
      'MindScript supports tracks up to 30 minutes in length, which covers everything from a quick 2-minute affirmation loop to a full guided meditation session. Most users find that 5 to 15 minutes is the sweet spot for daily practice, long enough for meaningful repetition but short enough to fit into any routine.',
  },
  {
    question: 'Can I edit my track after creating it?',
    answer:
      'Yes. You can return to any track in your library and update the script, swap the voice, change the background music, or adjust frequency settings. Each edit renders a fresh version of your track. Your first edit is free, and additional edits are available at a small fee so you can keep refining your practice as your goals evolve.',
  },
];

export default function CustomMeditationCreatorPage() {
  return (
    <>
      <FAQPageJsonLd items={faqItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://mindscript.studio' },
          { name: 'Custom Meditation Audio Creator' },
        ]}
      />

      {/* Hero */}
      <section className="pt-12 pb-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <PenTool className="w-4 h-4 mr-2" />
            Build Your Own Meditation Audio
          </div>
          <h1 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl leading-tight mb-6">
            <span className="text-text">Create </span>
            <span className="text-gradient">your own meditation</span>
            <span className="text-text"> audio</span>
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto leading-relaxed mb-8">
            Stop listening to someone else{`'`}s words in someone else{`'`}s voice. Write your
            script, choose your voice, layer in music and frequencies, and build a meditation
            track that is entirely yours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/builder"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors glow-primary text-lg"
            >
              Start Creating Your Track
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/30 text-text font-semibold hover:bg-white/80 transition-colors"
            >
              See How It Works
            </a>
          </div>
          <p className="text-sm text-muted mt-4">First track starting at $0.99</p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4 bg-white/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
              Simple 4-Step Process
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              How to Create Your Custom Meditation Audio
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number="1"
              title="Write"
              description="Craft your meditation script from scratch, paste one you already love, or let AI generate personalized affirmations and guided imagery for your goals."
            />
            <StepCard
              number="2"
              title="Speak"
              description="Pick from studio-quality AI voices, or clone your own voice so the meditation sounds like your inner dialogue speaking directly to your subconscious."
            />
            <StepCard
              number="3"
              title="Layer"
              description="Add background music from 20+ ambient tracks, mix in binaural beats for brainwave entrainment, and choose solfeggio frequencies to deepen the experience."
            />
            <StepCard
              number="4"
              title="Listen"
              description="Your track renders in minutes. Play it from your library anytime, build a daily practice, and edit whenever your intentions evolve."
            />
          </div>
        </div>
      </section>

      {/* Why Create Your Own - Comparison Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Creation vs Consumption
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              Why Create Your Own?
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Generic Apps - Muted */}
            <div className="bg-white/40 backdrop-blur-sm border border-white/30 rounded-2xl p-8">
              <h3 className="font-heading font-bold text-xl text-muted mb-6">
                Generic Meditation Apps
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-muted/40 shrink-0" />
                  <span className="text-muted">
                    Someone else{`'`}s voice reading someone else{`'`}s script
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-muted/40 shrink-0" />
                  <span className="text-muted">
                    One-size-fits-all content that may not match your goals
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-muted/40 shrink-0" />
                  <span className="text-muted">
                    No control over frequencies, music, or audio layering
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-muted/40 shrink-0" />
                  <span className="text-muted">
                    Passive consumption with no ownership of your practice
                  </span>
                </li>
              </ul>
            </div>

            {/* MindScript - Primary Accented */}
            <div className="bg-white/70 backdrop-blur-sm border border-primary/20 rounded-2xl p-8 shadow-sm shadow-primary/5">
              <h3 className="font-heading font-bold text-xl text-text mb-6">
                <span className="text-gradient">MindScript</span>
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-text">
                    Your voice speaking directly to your subconscious mind
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-text">
                    Words and affirmations that resonate with YOUR specific goals
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-text">
                    Binaural beats + solfeggio frequencies + music layered your way
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span className="text-text">
                    Active creation that increases motivation through autonomy
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Science Section */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              The Research
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              Why Personalized Meditation Works Better
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">
                Personalization Research
              </h3>
              <p className="text-muted leading-relaxed">
                A meta-analysis published in <em>Health Psychology Review</em> found that tailored
                interventions are significantly more effective than generic alternatives across
                health behaviors. When content matches an individual{`'`}s specific circumstances,
                goals, and language, engagement and adherence both increase measurably.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">
                Self-Determination Theory
              </h3>
              <p className="text-muted leading-relaxed">
                Deci and Ryan{`'`}s self-determination theory, one of the most cited frameworks in
                motivation research, identifies autonomy as a core psychological need. When people
                choose their own words, voice, and practice structure, intrinsic motivation
                increases and they are more likely to maintain the habit long-term.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">
                Self-Referential Speech Processing
              </h3>
              <p className="text-muted leading-relaxed">
                Neuroimaging studies show the brain processes self-referential content differently.
                Hearing your own voice activates the medial prefrontal cortex more strongly than
                hearing a stranger{`'`}s voice, engaging the same regions involved in self-reflection
                and identity. This may help personalized affirmations bypass the skepticism that
                often accompanies externally sourced positive statements.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">
                Brainwave Entrainment
              </h3>
              <p className="text-muted leading-relaxed">
                A 2020 study in <em>eLife</em> confirmed that binaural beats produce measurable
                neural entrainment, guiding brainwave activity toward a target frequency. When
                layered beneath a personalized meditation script, theta-range beats (4 to 8 Hz)
                can help the listener enter a deeply relaxed, receptive state.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              Everything You Need to Build Your Meditation
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="AI Script Assistance"
              description="Generate personalized meditation scripts and affirmations with AI, or write your own from scratch. Your words, your way."
            />
            <FeatureCard
              icon={<Mic className="w-6 h-6" />}
              title="Voice Cloning"
              description="Clone your own voice from a short recording so your meditation sounds like your inner dialogue speaking to you."
            />
            <FeatureCard
              icon={<Music className="w-6 h-6" />}
              title="20+ Background Tracks"
              description="Layer ambient soundscapes, nature sounds, or calming instrumentals beneath your voice for a rich audio experience."
            />
            <FeatureCard
              icon={<AudioLines className="w-6 h-6" />}
              title="Binaural Beats"
              description="Add theta, alpha, or delta binaural beats to guide your brainwaves into the ideal state for meditation and absorption."
            />
            <FeatureCard
              icon={<PenTool className="w-6 h-6" />}
              title="Solfeggio Frequencies"
              description="Choose from healing frequencies like 396 Hz, 528 Hz, or 741 Hz to complement your practice with tonal resonance."
            />
            <FeatureCard
              icon={<Download className="w-6 h-6" />}
              title="Easy Sharing"
              description="Access your finished tracks from any device in your library. Share your creations or keep them private for personal use."
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <LandingFAQ items={faqItems} />

      {/* CTA */}
      <LandingCTA
        heading="Create Your Own Meditation Audio"
        description="Build a personalized meditation track in minutes. Write your script, choose your voice, layer in frequencies and music, and start listening today."
        landingPage="/custom-meditation-creator"
      />
    </>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-heading font-bold text-xl text-text mb-2">{title}</h3>
      <p className="text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6 hover-lift">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white mb-4">
        {icon}
      </div>
      <h3 className="font-heading font-bold text-lg text-text mb-2">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}
