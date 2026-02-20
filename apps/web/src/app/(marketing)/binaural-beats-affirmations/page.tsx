import type { Metadata } from 'next';
import Link from 'next/link';
import { Headphones, AudioLines, Brain, Zap, Moon, Waves } from 'lucide-react';
import { generateMetadata as generateSeoMetadata } from '@/components/SEO/MetaTags';
import { FAQPageJsonLd, BreadcrumbJsonLd } from '@/components/SEO/JsonLd';
import { LandingFAQ } from '@/components/marketing/LandingFAQ';
import { LandingCTA } from '@/components/marketing/LandingCTA';
import { LandingHeroWithBuilder } from '@/components/marketing/LandingHeroWithBuilder';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Binaural Beats with Affirmations | MindScript',
  description:
    'Create custom binaural beats with positive affirmations. Choose theta, alpha, or delta frequencies, layer personalized affirmations, and build headphone-optimized audio tracks for focus, sleep, and manifestation.',
  keywords: [
    'binaural beats with affirmations',
    'custom binaural beats with positive affirmations',
    'binaural beats for subconscious mind',
    'how do binaural beats work on the brain',
    'theta binaural beats for manifestation',
    'create your own binaural beats audio',
  ],
  url: '/binaural-beats-affirmations',
  type: 'website',
});

const faqItems = [
  {
    question: 'Do binaural beats actually work?',
    answer:
      'A 2019 meta-analysis published in Psychological Research reviewed 22 studies and found small but consistent positive effects of binaural beats on anxiety reduction, memory, and attention. A 2020 study in eLife used EEG imaging to confirm that binaural beats produce measurable neural entrainment, meaning the brain genuinely synchronizes its electrical activity toward the target frequency. While effects vary by individual, the evidence supports binaural beats as a legitimate tool for influencing brainwave states.',
  },
  {
    question: 'What frequency is best for focus?',
    answer:
      'Beta-range binaural beats between 14 and 30 Hz are associated with alert, focused concentration. For creative focus that balances relaxation with awareness, alpha frequencies between 8 and 13 Hz are often preferred. Many users find that starting a session with alpha beats to calm the mind, then transitioning to low beta, provides the best sustained focus for deep work.',
  },
  {
    question: 'Do I need headphones for binaural beats?',
    answer:
      'Yes, headphones are required. Binaural beats work by sending a slightly different frequency to each ear; for example, 200 Hz in the left ear and 210 Hz in the right. Your brain perceives the 10 Hz difference as a single pulsing tone and entrains to that frequency. Without headphones, the two tones mix in open air before reaching your ears and the effect is lost. Over-ear or in-ear headphones both work.',
  },
  {
    question: 'How long should I listen to binaural beats?',
    answer:
      'Most research protocols use sessions of 15 to 30 minutes for noticeable effects. The brain needs at least 7 to 10 minutes to begin entraining to the target frequency, so shorter sessions may not produce meaningful results. For sleep tracks, 30 to 60 minutes is common since the audio continues through the transition into sleep. Consistency matters more than session length: daily 15-minute sessions outperform sporadic hour-long ones.',
  },
  {
    question: 'Can binaural beats help with manifestation?',
    answer:
      'Theta binaural beats (4 to 8 Hz) guide the brain into a state associated with deep meditation, creativity, and reduced critical filtering. This theta state is the same brainwave pattern observed during hypnosis and the moments just before sleep, when the subconscious mind is most receptive to suggestion. Combining theta beats with targeted affirmations allows positive statements to bypass conscious resistance, which is the core mechanism behind manifestation practices.',
  },
];

export default function BinauralBeatsAffirmationsPage() {
  return (
    <>
      <FAQPageJsonLd items={faqItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://mindscript.studio' },
          { name: 'Binaural Beats with Affirmations' },
        ]}
      />

      {/* Hero with Builder */}
      <LandingHeroWithBuilder
        badge={{ icon: <Headphones className="w-4 h-4" />, text: 'Brainwave Entrainment Technology' }}
        headline={
          <>
            <span className="text-text">Custom </span>
            <span className="text-gradient">binaural beats</span>
            <span className="text-text"> with affirmations</span>
          </>
        }
        description="Build personalized binaural beats audio layered with your own affirmations. Choose your target frequency, add background music, and create headphone-optimized tracks for focus, sleep, or manifestation."
        pricingLabel="Create Your Binaural Track for only"
        featurePills={[
          { icon: <Waves className="w-4 h-4" />, label: 'Custom Frequencies' },
          { icon: <AudioLines className="w-4 h-4" />, label: 'Layered Affirmations' },
          { icon: <Moon className="w-4 h-4" />, label: 'Sleep & Focus' },
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
              How Binaural Beats Work on the Brain
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Two Tones, One Frequency"
              description="A slightly different frequency plays in each ear. Your brain perceives the mathematical difference as a single pulsing tone and naturally synchronizes to it through neural entrainment."
            />
            <StepCard
              number="2"
              title="Layer Your Affirmations"
              description="Write personalized affirmations or use AI-assisted suggestions. Your statements are layered over the binaural carrier tones so they reach your brain during the entrained state."
            />
            <StepCard
              number="3"
              title="Listen with Headphones"
              description="Put on headphones and press play. The binaural beats guide your brainwaves to the target state while your affirmations work on a subconscious level. 15 to 30 minutes daily for best results."
            />
          </div>
        </div>
      </section>

      {/* Brainwave States Guide */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              Frequency Guide
            </div>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-text">
              The Five Brainwave States
            </h2>
            <p className="text-muted mt-4 max-w-2xl mx-auto">
              Each brainwave frequency range corresponds to a different mental state. Choose the right
              frequency for your goal.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <Moon className="w-5 h-5 text-indigo-500" />
                <h3 className="font-heading font-bold text-xl text-text">Delta (0.5 to 4 Hz)</h3>
              </div>
              <p className="text-muted leading-relaxed">
                The slowest brainwaves, dominant during deep dreamless sleep. A 2018 study in{' '}
                <em>Frontiers in Human Neuroscience</em> found that delta-range binaural beats
                improved deep sleep quality. Ideal for sleep-focused tracks and physical recovery.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <Waves className="w-5 h-5 text-purple-500" />
                <h3 className="font-heading font-bold text-xl text-text">Theta (4 to 8 Hz)</h3>
              </div>
              <p className="text-muted leading-relaxed">
                Associated with deep meditation, creativity, and the hypnagogic state just before
                sleep. Theta is the prime frequency for subconscious reprogramming because conscious
                critical filtering is at its lowest. Best for manifestation and affirmation work.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <Brain className="w-5 h-5 text-blue-500" />
                <h3 className="font-heading font-bold text-xl text-text">Alpha (8 to 13 Hz)</h3>
              </div>
              <p className="text-muted leading-relaxed">
                The relaxed-but-alert state: calm focus, light meditation, and creative flow. Alpha
                bridges the gap between conscious and subconscious processing. A great starting point
                for anyone new to binaural beats.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-heading font-bold text-xl text-text">Beta (14 to 30 Hz)</h3>
              </div>
              <p className="text-muted leading-relaxed">
                Active, analytical thinking and concentrated focus. Low beta (14 to 20 Hz) supports
                sustained attention, while high beta is linked to complex problem-solving. Choose
                beta for study sessions and productivity tracks.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <AudioLines className="w-5 h-5 text-rose-500" />
                <h3 className="font-heading font-bold text-xl text-text">Gamma (30 to 100 Hz)</h3>
              </div>
              <p className="text-muted leading-relaxed">
                The fastest brainwaves, associated with peak cognitive function, heightened
                perception, and information synthesis. Gamma states are observed during moments of
                insight and advanced meditation in experienced practitioners.
              </p>
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
              The Science Behind Binaural Beats
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Neural Entrainment Confirmed</h3>
              <p className="text-muted leading-relaxed">
                A 2020 study published in <em>eLife</em> used EEG recordings to demonstrate that
                binaural beats produce genuine neural entrainment. The brain{`'`}s electrical activity
                measurably synchronizes toward the target beat frequency, confirming this is a real
                neurological phenomenon rather than placebo.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Meta-Analysis: Anxiety, Memory, Attention</h3>
              <p className="text-muted leading-relaxed">
                A 2019 meta-analysis in <em>Psychological Research</em> reviewed 22 studies on
                binaural beats and found small but consistent positive effects across three domains:
                reduced anxiety, improved memory performance, and enhanced sustained attention. Effect
                sizes were modest but statistically significant.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Deep Sleep Enhancement</h3>
              <p className="text-muted leading-relaxed">
                A 2018 study in <em>Frontiers in Human Neuroscience</em> demonstrated that
                delta-frequency binaural beats (around 2 to 3 Hz) increased time spent in deep slow-wave
                sleep. Participants listening to delta beats before and during sleep onset showed
                improved sleep architecture compared to control groups.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Affirmations and the Subconscious</h3>
              <p className="text-muted leading-relaxed">
                Research in <em>Social Cognitive and Affective Neuroscience</em> shows that
                self-affirmation activates the ventromedial prefrontal cortex, a brain region tied to
                self-valuation. Combining affirmations with theta-state binaural beats may enhance
                absorption by delivering positive statements when critical filtering is reduced.
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
              Everything You Need to Create Your Own Binaural Beats Audio
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Waves className="w-6 h-6" />}
              title="Custom Frequency Selection"
              description="Choose from delta, theta, alpha, beta, or gamma ranges. Dial in the exact frequency for your goal, whether it's deep sleep, focus, or creative flow."
            />
            <FeatureCard
              icon={<AudioLines className="w-6 h-6" />}
              title="Layered Affirmations"
              description="Write personalized affirmations that play over your binaural beats. Choose your voice or clone your own for maximum subconscious impact."
            />
            <FeatureCard
              icon={<Headphones className="w-6 h-6" />}
              title="Headphone-Optimized Audio"
              description="Stereo separation is precisely calibrated so each ear receives the correct frequency. Your binaural beats work exactly as intended."
            />
            <FeatureCard
              icon={<Moon className="w-6 h-6" />}
              title="Sleep-Optimized Tracks"
              description="Build delta and theta tracks designed for the pre-sleep window. Gentle volume curves and calming tones guide you into restful sleep."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Focus-Enhancing Presets"
              description="Alpha and beta frequency presets tuned for deep work, study sessions, and sustained concentration. Just add your affirmations and go."
            />
            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="Background Music Library"
              description="Layer ambient music beneath your binaural beats and affirmations. Curated tracks blend seamlessly without interfering with entrainment."
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
            Dive deeper into the science behind brainwave frequencies and audio-based tools.
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
          </div>
        </div>
      </section>

      {/* FAQ */}
      <LandingFAQ items={faqItems} />

      {/* CTA */}
      <LandingCTA
        heading="Create Your Custom Binaural Beats Track"
        description="Combine binaural beats with personalized affirmations, background music, and the perfect frequency for your goal. Build your first track in minutes."
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
