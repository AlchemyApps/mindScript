import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, AudioLines, Music, Layers, Volume2, Smartphone } from 'lucide-react';
import { generateMetadata as generateSeoMetadata } from '@/components/SEO/MetaTags';
import { FAQPageJsonLd, BreadcrumbJsonLd } from '@/components/SEO/JsonLd';
import { LandingFAQ } from '@/components/marketing/LandingFAQ';
import { LandingCTA } from '@/components/marketing/LandingCTA';
import { LandingHeroWithBuilder } from '@/components/marketing/LandingHeroWithBuilder';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Solfeggio Frequencies with Affirmations | MindScript',
  description:
    'Create custom solfeggio frequency audio layered with personalized affirmations. All 9 frequencies from 174 Hz to 963 Hz, combined with binaural beats and background music.',
  keywords: [
    'solfeggio frequencies with affirmations',
    '528 hz love frequency meditation audio',
    '432 hz vs 528 hz',
    'solfeggio frequencies explained science',
    'custom solfeggio frequency audio creator',
    '396 hz fear release frequency',
    'all 9 solfeggio frequencies and their benefits',
  ],
  url: '/solfeggio-frequencies',
  type: 'website',
});

const faqItems = [
  {
    question: 'What are solfeggio frequencies?',
    answer:
      'Solfeggio frequencies are a set of nine tones derived from an ancient musical scale. The core frequencies are 174, 285, 396, 417, 528, 639, 741, 852, and 963 Hz. Each frequency is traditionally associated with specific physical and emotional benefits. While their historical origins are debated, modern research, particularly on 528 Hz, has begun exploring their measurable effects on the body and mind.',
  },
  {
    question: 'What does 528 Hz do?',
    answer:
      'Known as the "Love Frequency" or "Miracle Tone," 528 Hz is the most studied solfeggio frequency. A 2018 study in the Journal of Addiction Research and Therapy found that 528 Hz significantly reduced anxiety in participants. Separate research has shown it may lower cortisol levels and increase oxytocin production. It is traditionally associated with transformation, DNA repair, and emotional healing.',
  },
  {
    question: 'Do solfeggio frequencies really work?',
    answer:
      'Research is promising but still in early stages. Peer-reviewed studies have demonstrated measurable physiological effects, particularly for 528 Hz (reduced anxiety, lower cortisol) and 396 Hz (stress reduction). Music therapy meta-analyses support the broader principle that specific tonal patterns influence mood and physiology. However, more large-scale research is needed to fully validate all traditional claims associated with each frequency.',
  },
  {
    question: 'Do I need headphones to listen to solfeggio frequencies?',
    answer:
      'No, unlike binaural beats which require headphones to create their effect through stereo separation, solfeggio frequencies work through speakers or headphones equally well. Each frequency is a single tone that does not depend on left-right ear differences. That said, headphones can help you focus and block out external noise, especially when combining solfeggio tones with affirmations.',
  },
  {
    question: 'What is the difference between solfeggio frequencies and binaural beats?',
    answer:
      'Solfeggio frequencies are specific single tones (like 528 Hz) played directly and heard as-is. Binaural beats use two slightly different frequencies in each ear to create a perceived third frequency that influences brainwave patterns. They work through completely different mechanisms. MindScript lets you combine both in a single track: solfeggio tones for their frequency-specific benefits and binaural beats for brainwave entrainment, layered together with your personalized affirmations.',
  },
];

const solfeggioFrequencies = [
  { hz: 174, name: 'Foundation', association: 'Pain relief and physical comfort' },
  { hz: 285, name: 'Restoration', association: 'Tissue healing and cellular repair' },
  { hz: 396, name: 'Liberation', association: 'Release of fear and guilt' },
  { hz: 417, name: 'Transformation', association: 'Clearing negativity and facilitating change' },
  { hz: 528, name: 'Love Frequency', association: 'Healing, DNA repair, and transformation' },
  { hz: 639, name: 'Connection', association: 'Harmonizing relationships' },
  { hz: 741, name: 'Awakening', association: 'Self-expression and problem solving' },
  { hz: 852, name: 'Intuition', association: 'Returning to spiritual order' },
  { hz: 963, name: 'Unity', association: 'Divine consciousness and oneness' },
];

export default function SolfeggioFrequenciesPage() {
  return (
    <>
      <FAQPageJsonLd items={faqItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://mindscript.studio' },
          { name: 'Solfeggio Frequencies with Affirmations' },
        ]}
      />

      {/* Hero with Builder */}
      <LandingHeroWithBuilder
        badge={{ icon: <Sparkles className="w-4 h-4" />, text: 'All 9 Healing Frequencies' }}
        headline={
          <>
            <span className="text-text">Solfeggio frequencies </span>
            <span className="text-gradient">with affirmations</span>
          </>
        }
        description="Layer all 9 solfeggio frequencies with personalized affirmations, binaural beats, and curated background music. From 174 Hz pain relief to 963 Hz divine connection, create the exact healing audio your practice needs."
        pricingLabel="Create Your Solfeggio Track for only"
        featurePills={[
          { icon: <Sparkles className="w-4 h-4" />, label: 'All 9 Frequencies' },
          { icon: <AudioLines className="w-4 h-4" />, label: 'Layered Affirmations' },
          { icon: <Music className="w-4 h-4" />, label: 'Background Music' },
        ]}
      />

      {/* All 9 Solfeggio Frequencies Grid */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
              The Complete Scale
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              All 9 Solfeggio Frequencies and Their Benefits
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {solfeggioFrequencies.map((freq) => (
              <div
                key={freq.hz}
                className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6 hover-lift"
              >
                <div className="text-3xl font-bold text-gradient mb-1">{freq.hz} Hz</div>
                <h3 className="font-heading font-bold text-lg text-text mb-2">{freq.name}</h3>
                <p className="text-muted text-sm leading-relaxed">{freq.association}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Simple 3-Step Process
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              How to Create Your Solfeggio Frequency Audio
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Write Your Affirmations"
              description="Craft personalized affirmations or let AI help you write statements aligned with your chosen frequency. Pair 528 Hz with love affirmations, 396 Hz with fear-release statements, and more."
            />
            <StepCard
              number="2"
              title="Choose Your Frequencies"
              description="Select from all 9 solfeggio frequencies. Layer with binaural beats for brainwave entrainment, add background music, and adjust each volume independently."
            />
            <StepCard
              number="3"
              title="Listen and Heal"
              description="Play your track through speakers or headphones. No special equipment needed for solfeggio frequencies. Listen during meditation, work, sleep, or any quiet moment."
            />
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
              The Science Behind Solfeggio Frequencies
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">528 Hz and Anxiety Reduction</h3>
              <p className="text-muted leading-relaxed">
                A 2018 study published in the <em>Journal of Addiction Research and Therapy</em> found
                that exposure to 528 Hz music significantly reduced anxiety in participants compared to
                a control group listening to 440 Hz music. The 528 Hz group showed measurable decreases
                in cortisol levels, suggesting a direct physiological mechanism.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Psychoacoustics Research</h3>
              <p className="text-muted leading-relaxed">
                Psychoacoustics, the study of how humans perceive sound, has demonstrated that specific
                frequencies and tonal patterns produce measurable changes in autonomic nervous system
                activity. Research shows that certain frequencies can influence heart rate variability,
                respiratory rate, and skin conductance, supporting the idea that sound frequencies
                affect physiology.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Music Therapy Evidence</h3>
              <p className="text-muted leading-relaxed">
                Meta-analyses in music therapy research, published in journals like <em>Cochrane
                Database of Systematic Reviews</em>, consistently show that structured sound
                interventions reduce stress, improve mood, and support pain management. While these
                studies cover music therapy broadly, the mechanisms support frequency-specific effects
                as a component of therapeutic audio design.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Combining Frequencies with Affirmations</h3>
              <p className="text-muted leading-relaxed">
                Research on self-affirmation from <em>Social Cognitive and Affective Neuroscience</em> shows
                affirmations activate the brain{`'`}s reward centers. Combining this with frequency-specific
                physiological effects creates a multi-channel approach: solfeggio tones work on the body
                while affirmations work on belief patterns, reinforcing each other for deeper impact.
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
              Everything You Need for Solfeggio Frequency Audio
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="All 9 Frequencies"
              description="Access the complete solfeggio scale from 174 Hz to 963 Hz. Choose the frequency that matches your intention."
            />
            <FeatureCard
              icon={<AudioLines className="w-6 h-6" />}
              title="Layer with Affirmations"
              description="Combine healing frequencies with personalized affirmations in your own voice or premium AI voices."
            />
            <FeatureCard
              icon={<Layers className="w-6 h-6" />}
              title="Add Binaural Beats"
              description="Stack solfeggio tones with binaural beats for simultaneous frequency healing and brainwave entrainment."
            />
            <FeatureCard
              icon={<Music className="w-6 h-6" />}
              title="Background Music"
              description="Choose from curated ambient, piano, and nature tracks designed to complement your frequency selection."
            />
            <FeatureCard
              icon={<Volume2 className="w-6 h-6" />}
              title="Custom Volume Mixing"
              description="Independently control the volume of your voice, solfeggio tones, binaural beats, and background music."
            />
            <FeatureCard
              icon={<Smartphone className="w-6 h-6" />}
              title="Export for Any Device"
              description="Download your finished track and listen on any device. No special apps or headphones required for solfeggio frequencies."
            />
          </div>
        </div>
      </section>

      {/* Blog links */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-text mb-6">
            Learn More
          </h2>
          <p className="text-muted mb-8 max-w-xl mx-auto">
            Dive deeper into the science and history behind solfeggio frequencies and related audio tools.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/blog/solfeggio-frequencies-explained"
              className="px-6 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50 text-text font-medium hover:bg-white/90 transition-colors hover-lift"
            >
              Solfeggio Frequencies Explained
            </Link>
            <Link
              href="/blog/what-are-binaural-beats"
              className="px-6 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50 text-text font-medium hover:bg-white/90 transition-colors hover-lift"
            >
              What Are Binaural Beats?
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <LandingFAQ items={faqItems} />

      {/* CTA */}
      <LandingCTA
        heading="Create Your Solfeggio Frequency Track"
        description="Layer healing frequencies with personalized affirmations, binaural beats, and background music. Build your custom solfeggio audio in minutes and start listening today."
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
