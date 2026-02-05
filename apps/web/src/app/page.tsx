'use client';

import { Header } from '../components/navigation/Header';
import { Footer } from '../components/navigation/Footer';
import { HeroSection } from '../components/landing/HeroSection';
import { FloatingOrbs } from '../components/landing/FloatingOrbs';
import { StepBuilder } from '../components/builder/StepBuilder';
import { AudioLines, Headphones, Smartphone, Sparkles, Heart, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-warm-gradient">
      <Header variant="transparent" />

      <main className="flex-1">
        {/* Hero Section with Builder */}
        <HeroSection>
          <StepBuilder variant="card" className="max-w-2xl mx-auto" />
        </HeroSection>

        {/* Features Section */}
        <section id="features" className="relative py-20 px-4 overflow-hidden">
          <FloatingOrbs variant="subtle" />

          <div className="container mx-auto relative">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                Why MindScript
              </span>
              <h2 className="text-3xl md:text-4xl font-bold font-heading text-text mb-4">
                Everything you need to transform your mindset
              </h2>
              <p className="text-muted max-w-2xl mx-auto">
                Combine cutting-edge AI technology with ancient wisdom for personalized audio
                experiences that actually work.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<AudioLines className="w-6 h-6" />}
                title="Premium AI Voices"
                description="Choose from OpenAI's natural voices or ElevenLabs' ultra-realistic premium voices. Find the perfect tone for your affirmations."
                gradient="from-primary to-primary-light"
              />
              <FeatureCard
                icon={<Headphones className="w-6 h-6" />}
                title="Healing Frequencies"
                description="Add Solfeggio frequencies for DNA repair and healing, or binaural beats for meditation, focus, and deep sleep."
                gradient="from-accent to-accent-light"
              />
              <FeatureCard
                icon={<Smartphone className="w-6 h-6" />}
                title="Listen Anywhere"
                description="Access your personalized tracks on web and mobile. Download for offline listening during your morning routine or meditation."
                gradient="from-warm-gold to-soft"
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 px-4 bg-white/50">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                Simple Process
              </span>
              <h2 className="text-3xl md:text-4xl font-bold font-heading text-text mb-4">
                Create your track in minutes
              </h2>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <ProcessStep
                step={1}
                title="Choose Your Intention"
                description="Select from confidence, sleep, focus, abundance, healing, or create your own."
              />
              <ProcessStep
                step={2}
                title="Write or Enhance"
                description="Write your affirmations or let our AI help you craft the perfect script."
              />
              <ProcessStep
                step={3}
                title="Customize Sound"
                description="Pick your voice, add frequencies, and choose ambient soundscapes."
              />
              <ProcessStep
                step={4}
                title="Download & Listen"
                description="Get your high-quality audio track instantly. Play it daily for best results."
              />
            </div>
          </div>
        </section>

        {/* Testimonials / Social Proof Section */}
        <section className="py-20 px-4 relative overflow-hidden">
          <FloatingOrbs variant="subtle" />

          <div className="container mx-auto relative">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 rounded-full bg-soft/50 text-warm-gold text-sm font-medium mb-4">
                Loved by Creators
              </span>
              <h2 className="text-3xl md:text-4xl font-bold font-heading text-text mb-4">
                Join thousands transforming their mindset
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <TestimonialCard
                quote="I've tried meditation apps for years, but creating my own affirmations with MindScript made all the difference. The binaural beats help me fall asleep in minutes."
                author="Sarah K."
                role="Yoga Instructor"
              />
              <TestimonialCard
                quote="The quality of the AI voices is incredible. I use my confidence track every morning before important meetings. It's become a non-negotiable part of my routine."
                author="Marcus T."
                role="Startup Founder"
              />
              <TestimonialCard
                quote="As a therapist, I recommend MindScript to clients who want to reinforce positive thought patterns. The science behind the frequencies is solid."
                author="Dr. Lisa Chen"
                role="Clinical Psychologist"
              />
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-3xl mx-auto">
              <StatItem value="10,000+" label="Tracks Created" />
              <StatItem value="4.9/5" label="User Rating" />
              <StatItem value="50+" label="Voice Options" />
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="py-16 px-4 bg-deep-purple text-white">
          <div className="container mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              <TrustBadge icon={<Shield className="w-5 h-5" />} text="Secure Payments" />
              <TrustBadge icon={<Heart className="w-5 h-5" />} text="Lifetime Access" />
              <TrustBadge icon={<Sparkles className="w-5 h-5" />} text="AI-Powered" />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 relative overflow-hidden bg-hero-gradient">
          <FloatingOrbs variant="vibrant" />

          <div className="container mx-auto relative text-center">
            <h2 className="text-3xl md:text-5xl font-bold font-heading text-text mb-6">
              Ready to transform your{' '}
              <span className="text-gradient">inner voice</span>?
            </h2>
            <p className="text-lg text-muted mb-8 max-w-2xl mx-auto">
              Create your first personalized affirmation track today with special pricing.
              Start your journey to a calmer, more focused mind.
            </p>
            <a
              href="#builder"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-white font-semibold text-lg hover:bg-primary/90 transition-all duration-300 glow-primary"
            >
              <Sparkles className="w-5 h-5" />
              Create Your First Track
            </a>
            <p className="mt-4 text-sm text-muted">
              First track only $0.99 • Regular price $2.99
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50 hover-lift transition-all duration-300">
      <div
        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-4 transition-transform group-hover:scale-110`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      <p className="text-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function ProcessStep({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
        <span className="text-xl font-bold text-primary">{step}</span>
      </div>
      <h3 className="font-semibold text-text mb-2">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function TestimonialCard({
  quote,
  author,
  role,
}: {
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/50">
      <p className="text-muted italic mb-4">"{quote}"</p>
      <div>
        <p className="font-semibold text-text">{author}</p>
        <p className="text-sm text-muted">{role}</p>
      </div>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl font-bold text-primary mb-1">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-white/80">
      {icon}
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}
