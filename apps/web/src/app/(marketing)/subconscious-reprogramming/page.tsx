import type { Metadata } from 'next';
import Link from 'next/link';
import { Brain, AudioLines, Headphones, Moon, Sparkles, Shield } from 'lucide-react';
import { generateMetadata as generateSeoMetadata } from '@/components/SEO/MetaTags';
import { FAQPageJsonLd, BreadcrumbJsonLd } from '@/components/SEO/JsonLd';
import { LandingFAQ } from '@/components/marketing/LandingFAQ';
import { LandingCTA } from '@/components/marketing/LandingCTA';
import { LandingHeroWithBuilder } from '@/components/marketing/LandingHeroWithBuilder';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Subconscious Reprogramming Audio | MindScript',
  description:
    'Create personalized subconscious reprogramming audio with your own voice, binaural beats, and solfeggio frequencies. Science-backed tools for training your subconscious mind.',
  keywords: [
    'subconscious reprogramming audio',
    'reprogram subconscious mind',
    'subconscious mind training app',
    'audio to reprogram subconscious beliefs',
    'theta state subconscious reprogramming',
  ],
  url: '/subconscious-reprogramming',
  type: 'website',
});

const faqItems = [
  {
    question: 'Does listening to affirmations reprogram the brain?',
    answer:
      'Yes. fMRI research published in Social Cognitive and Affective Neuroscience shows that self-affirmation activates the ventromedial prefrontal cortex and ventral striatum, brain regions linked to positive self-valuation. Repeated listening strengthens these neural pathways through neuroplasticity, gradually shifting default thought patterns over weeks of consistent practice.',
  },
  {
    question: 'How long does it take to reprogram your subconscious mind?',
    answer:
      'Research on habit formation suggests approximately 66 days of consistent daily repetition for a new thought pattern to become automatic. Short daily sessions of 10 to 20 minutes are more effective than occasional long ones. Results vary by individual, but most people report noticeable shifts in self-talk patterns within 3 to 4 weeks.',
  },
  {
    question: 'What is theta state subconscious reprogramming?',
    answer:
      'Theta brainwaves (4 to 8 Hz) occur during light sleep and deep meditation, when the conscious critical filter is least active. During theta states, suggestions and affirmations can reach the subconscious more directly. Binaural beats tuned to theta frequencies can help guide your brain into this receptive state while you listen to personalized affirmations.',
  },
  {
    question: 'Is it better to use your own voice for affirmations?',
    answer:
      'Research in psycholinguistics suggests the brain processes self-referential speech differently than external voices. Your own voice carries implicit self-recognition that may bypass resistance to positive statements. MindScript lets you record your own voice or choose from studio-quality AI voices, so you can use whichever feels most effective for you.',
  },
  {
    question: 'Can you reprogram your subconscious mind while sleeping?',
    answer:
      'The transition periods around sleep, the first 20 minutes after waking and the last 20 minutes before sleep, are when your brain moves through theta and alpha states where the subconscious is most receptive. During deep sleep itself, auditory processing is reduced. For best results, listen during these transition windows rather than during deep sleep.',
  },
];

export default function SubconsciousReprogrammingPage() {
  return (
    <>
      <FAQPageJsonLd items={faqItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://mindscript.studio' },
          { name: 'Subconscious Reprogramming Audio' },
        ]}
      />

      {/* Hero with Builder */}
      <LandingHeroWithBuilder
        badge={{ icon: <Brain className="w-4 h-4" />, text: 'Science-Backed Audio Tools' }}
        headline={
          <>
            <span className="text-text">Reprogram your </span>
            <span className="text-gradient">subconscious mind</span>
            <span className="text-text"> with audio</span>
          </>
        }
        description="Create personalized subconscious reprogramming audio that combines your own voice with binaural beats, solfeggio frequencies, and curated background music. Your words, your voice, your transformation."
        pricingLabel="Start Reprogramming Your Mind for only"
        featurePills={[
          { icon: <AudioLines className="w-4 h-4" />, label: 'Studio Voices' },
          { icon: <Headphones className="w-4 h-4" />, label: 'Binaural Beats' },
          { icon: <Sparkles className="w-4 h-4" />, label: 'Solfeggio Tones' },
        ]}
      />

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4 bg-white/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
              Simple 3-Step Process
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              How Subconscious Reprogramming Audio Works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Write Your Script"
              description="Choose affirmations that resonate with you, or let AI help craft personalized statements targeting the beliefs you want to change."
            />
            <StepCard
              number="2"
              title="Layer Your Audio"
              description="Pick your voice (or clone your own), select background music, and add theta binaural beats or solfeggio frequencies to deepen the effect."
            />
            <StepCard
              number="3"
              title="Listen Daily"
              description="Play your track during morning or bedtime transition states when your subconscious is most receptive. Consistency builds new neural pathways."
            />
          </div>
        </div>
      </section>

      {/* Science Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              The Research
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              The Science Behind Subconscious Reprogramming
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Neuroplasticity</h3>
              <p className="text-muted leading-relaxed">
                Your brain physically restructures itself based on repeated experience. Research
                published in <em>Nature Reviews Neuroscience</em> confirms that consistent
                repetition of thoughts and behaviors strengthens specific neural pathways while
                weakening unused ones. This is the mechanism behind subconscious reprogramming.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Self-Affirmation Theory</h3>
              <p className="text-muted leading-relaxed">
                A 2016 study in <em>Social Cognitive and Affective Neuroscience</em> used fMRI to
                show that self-affirmation activates the brain{`'`}s reward centers (ventromedial
                prefrontal cortex). Participants who practiced affirmations showed measurable changes
                in brain activity patterns over time.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Brainwave Entrainment</h3>
              <p className="text-muted leading-relaxed">
                A 2020 study in <em>eLife</em> confirmed that binaural beats cause measurable neural
                entrainment, guiding brainwave activity toward a target frequency. Theta-range beats
                (4 to 8 Hz) are particularly relevant for subconscious work, as theta states are
                associated with reduced conscious filtering.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Repetition and Habit</h3>
              <p className="text-muted leading-relaxed">
                Research published in the <em>European Journal of Social Psychology</em> found that
                new automatic behaviors take an average of 66 days to form. Audio affirmations
                leverage this principle by making daily repetition effortless: press play and let
                your subconscious absorb the message.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              Everything You Need to Train Your Subconscious
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<AudioLines className="w-6 h-6" />}
              title="Studio AI Voices"
              description="Choose from premium voices or clone your own. Your brain responds uniquely to self-referential speech."
            />
            <FeatureCard
              icon={<Headphones className="w-6 h-6" />}
              title="Binaural Beats"
              description="Theta-range frequencies guide your brain into the receptive state where reprogramming is most effective."
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="Solfeggio Frequencies"
              description="Layer healing tones like 528 Hz alongside your affirmations for a richer audio experience."
            />
            <FeatureCard
              icon={<Moon className="w-6 h-6" />}
              title="Sleep-Ready Tracks"
              description="Create tracks designed for the pre-sleep theta window when your subconscious is most receptive."
            />
            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="Personalized Scripts"
              description="Write your own affirmations or get AI-assisted suggestions tailored to the beliefs you want to change."
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title="Graduated Approach"
              description="Start with believable statements and progress. Effective reprogramming works with your brain, not against it."
            />
          </div>
        </div>
      </section>

      {/* Blog links */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-text mb-6">
            Learn More
          </h2>
          <p className="text-muted mb-8 max-w-xl mx-auto">
            Explore the science behind the tools in your audio tracks.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/blog/what-are-binaural-beats"
              className="px-6 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50 text-text font-medium hover:bg-white/90 transition-colors hover-lift"
            >
              What Are Binaural Beats?
            </Link>
            <Link
              href="/blog/solfeggio-frequencies-explained"
              className="px-6 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50 text-text font-medium hover:bg-white/90 transition-colors hover-lift"
            >
              Solfeggio Frequencies Explained
            </Link>
            <Link
              href="/blog/how-affirmations-rewire-your-brain"
              className="px-6 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50 text-text font-medium hover:bg-white/90 transition-colors hover-lift"
            >
              How Affirmations Rewire Your Brain
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <LandingFAQ items={faqItems} />

      {/* CTA */}
      <LandingCTA
        heading="Start Reprogramming Your Subconscious"
        description="Create your first personalized audio track in minutes. Combine your voice, frequencies, and music into a daily practice that rewires your brain."
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
