import type { Metadata } from 'next';
import Link from 'next/link';
import { Brain, Zap, Target, Clock, Repeat, TrendingUp } from 'lucide-react';
import { generateMetadata as generateSeoMetadata } from '@/components/SEO/MetaTags';
import { FAQPageJsonLd, BreadcrumbJsonLd } from '@/components/SEO/JsonLd';
import { LandingFAQ } from '@/components/marketing/LandingFAQ';
import { LandingCTA } from '@/components/marketing/LandingCTA';
import { LandingHeroWithBuilder } from '@/components/marketing/LandingHeroWithBuilder';

export const metadata: Metadata = generateSeoMetadata({
  title: 'Brain Training Audio | MindScript',
  description:
    'Train your brain with personalized audio combining sound frequencies, brainwave entrainment, and neuroplasticity-optimized repetition. A daily gym for your mind that strengthens neural pathways.',
  keywords: [
    'brain training audio',
    'train your brain with sound frequencies',
    'brainwave entrainment for focus',
    'audio for mental performance',
    'how sound affects brainwaves',
    'neuroplasticity and audio programming',
  ],
  url: '/brain-training-audio',
  type: 'website',
});

const faqItems = [
  {
    question: 'Does brain training with audio actually work?',
    answer:
      'Yes. Research in neuroplasticity, pioneered by scientists like Michael Merzenich and documented by Norman Doidge in The Brain That Changes Itself, confirms that repeated sensory stimulation reshapes neural pathways. EEG studies show that audio stimulation, particularly brainwave entrainment through binaural beats, produces measurable changes in brainwave patterns. When combined with targeted affirmations, audio training leverages both auditory processing and self-directed neuroplasticity.',
  },
  {
    question: 'What brainwave state is best for learning?',
    answer:
      'Alpha waves (8 to 12 Hz) are associated with relaxed focus and are considered ideal for absorbing new information. Theta waves (4 to 8 Hz) support deeper encoding and creative insight. Beta waves (12 to 30 Hz) are linked to active concentration and problem-solving. The best state depends on the task: alpha for learning and retention, theta for reprogramming beliefs, and beta for focused analytical work. MindScript lets you target specific brainwave ranges with binaural beats.',
  },
  {
    question: 'How does sound affect the brain?',
    answer:
      'Sound waves are processed by the auditory cortex and influence brainwave activity through a process called neural entrainment. When you hear a steady rhythmic stimulus, your brainwaves tend to synchronize with that frequency. Binaural beats exploit this by presenting slightly different frequencies to each ear, causing the brain to perceive and entrain to the difference frequency. Beyond entrainment, spoken affirmations activate language processing areas and the ventromedial prefrontal cortex, reinforcing new thought patterns.',
  },
  {
    question: 'How often should I use brain training audio?',
    answer:
      'Daily practice of 10 to 20 minutes produces the best results. Neuroscience research on use-dependent plasticity shows that consistent, repeated stimulation is what drives lasting neural changes. Just as physical exercise requires regular sessions to build strength, brain training audio works through accumulated daily exposure. Most users notice improvements in focus and mental clarity within 2 to 3 weeks of consistent daily listening.',
  },
  {
    question: 'Is audio brain training the same as meditation?',
    answer:
      'They share some overlap but are distinct practices. Meditation typically involves self-directed attention and awareness, while audio brain training uses external sound stimuli to guide brainwave states and deliver targeted content like affirmations. Audio brain training can complement a meditation practice by helping you reach specific brainwave states more quickly, but it also works as a standalone tool for people who find traditional meditation difficult.',
  },
];

export default function BrainTrainingAudioPage() {
  return (
    <>
      <FAQPageJsonLd items={faqItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://mindscript.studio' },
          { name: 'Brain Training Audio' },
        ]}
      />

      {/* Hero with Builder */}
      <LandingHeroWithBuilder
        badge={{ icon: <Brain className="w-4 h-4" />, text: 'A Gym for Your Mind' }}
        headline={
          <>
            <span className="text-text">Train your brain with </span>
            <span className="text-gradient">sound frequencies</span>
          </>
        }
        description="Create personalized brain training audio that combines brainwave entrainment, targeted affirmations, and neuroplasticity-optimized repetition. Daily audio practice that strengthens neural pathways and sharpens mental performance."
        pricingLabel="Start Training Your Brain for only"
        featurePills={[
          { icon: <Target className="w-4 h-4" />, label: 'Brainwave Targeting' },
          { icon: <Zap className="w-4 h-4" />, label: 'Focus Frequencies' },
          { icon: <Repeat className="w-4 h-4" />, label: 'Daily Training' },
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
              How Brain Training Audio Works
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Design Your Training"
              description="Write affirmations and mental scripts targeting focus, clarity, or any cognitive goal. AI can help you craft statements optimized for neuroplastic change."
            />
            <StepCard
              number="2"
              title="Set Your Frequencies"
              description="Choose your voice, layer brainwave-targeting binaural beats, and add background music. Each element is tuned to support your specific training goal."
            />
            <StepCard
              number="3"
              title="Train Daily"
              description="Listen for 10 to 20 minutes each day. Consistent repetition drives use-dependent plasticity, building stronger neural pathways with every session."
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
              The Science Behind Audio Brain Training
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Neuroplasticity and Use-Dependent Plasticity</h3>
              <p className="text-muted leading-relaxed">
                Michael Merzenich{`'`}s pioneering research demonstrated that the brain physically
                reorganizes itself in response to repeated stimulation. This principle, known as
                use-dependent plasticity, means that neurons that fire together wire together
                (Hebb{`'`}s rule). Consistent audio training creates stronger, more efficient neural
                pathways for the mental states you want to cultivate.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Brainwave Entrainment</h3>
              <p className="text-muted leading-relaxed">
                EEG research confirms that auditory stimulation at specific frequencies causes
                measurable neural entrainment. A 2020 study in <em>eLife</em> showed that binaural
                beats produce real changes in brainwave patterns. By targeting alpha (8 to 12 Hz)
                for focused learning or theta (4 to 8 Hz) for deep encoding, you can train your
                brain to access optimal mental states on demand.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Working Memory and Audio Training</h3>
              <p className="text-muted leading-relaxed">
                Research published in <em>Nature</em> and related journals has shown that targeted
                cognitive training can improve working memory capacity. Audio-based approaches are
                particularly effective because they engage sustained attention and auditory
                processing circuits simultaneously, strengthening the neural networks that underpin
                focus, recall, and mental performance.
              </p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm border border-white/50 rounded-2xl p-6">
              <h3 className="font-heading font-bold text-xl text-text mb-3">Repetition and Neural Pathway Strengthening</h3>
              <p className="text-muted leading-relaxed">
                Norman Doidge documented in <em>The Brain That Changes Itself</em> how repeated
                practice physically thickens myelin sheaths around active neural pathways, making
                signal transmission faster and more reliable. Daily audio training leverages this
                mechanism: each listening session reinforces the thought patterns and mental states
                encoded in your personalized track.
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
              Everything You Need to Train Your Brain
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Target className="w-6 h-6" />}
              title="Custom Brainwave Targeting"
              description="Select specific frequency ranges to target alpha, theta, or beta states depending on your training goal."
            />
            <FeatureCard
              icon={<Clock className="w-6 h-6" />}
              title="Daily Training Tracks"
              description="Build audio sessions designed for consistent daily practice. Short, focused sessions that fit any schedule."
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="Focus-Enhancing Frequencies"
              description="Binaural beats tuned to concentration-boosting ranges help you enter and sustain deep focus states."
            />
            <FeatureCard
              icon={<Repeat className="w-6 h-6" />}
              title="Neuroplasticity-Optimized Repetition"
              description="Track structures designed around the science of spaced repetition and use-dependent plasticity for maximum neural impact."
            />
            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="Personalized Scripts"
              description="Write your own mental training scripts or use AI-assisted suggestions tailored to your cognitive goals."
            />
            <FeatureCard
              icon={<TrendingUp className="w-6 h-6" />}
              title="Works With Any Schedule"
              description="Morning focus sessions, midday resets, or evening wind-downs. Train your brain whenever works best for you."
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
            Explore the science behind the frequencies and techniques in your brain training audio.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/blog/what-are-binaural-beats"
              className="px-6 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-white/50 text-text font-medium hover:bg-white/90 transition-colors hover-lift"
            >
              What Are Binaural Beats?
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
        heading="Start Training Your Brain Today"
        description="Create your first personalized brain training audio in minutes. Combine targeted frequencies, your own voice, and neuroplasticity-backed repetition into a daily practice that strengthens your mind."
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
