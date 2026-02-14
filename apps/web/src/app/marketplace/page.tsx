"use client";

import Link from "next/link";
import { ShoppingBag, Users, Music2, Sparkles, ArrowRight } from "lucide-react";
import { FloatingOrbs } from "@/components/landing/FloatingOrbs";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradientButton } from "@/components/ui/GradientButton";
import { Header } from "@/components/navigation/Header";
import { usePlayerStore } from "@/store/playerStore";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: <ShoppingBag className="w-6 h-6" />,
    title: "Browse Tracks",
    description:
      "Explore a curated library of meditation, affirmation, and mindfulness tracks created by the community.",
    gradient: "from-primary to-primary-light",
  },
  {
    icon: <Music2 className="w-6 h-6" />,
    title: "Sell Your Creations",
    description:
      "Turn your tracks into products. Set your price, publish to the marketplace, and earn from every sale.",
    gradient: "from-accent to-emerald-400",
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Discover Artists",
    description:
      "Find creators who share your vibe. Follow their journey and get notified when they publish new tracks.",
    gradient: "from-purple-500 to-pink-500",
  },
];

export default function MarketplacePage() {
  const { currentTrack, playerMode } = usePlayerStore();

  return (
    <div
      className={cn(
        "min-h-screen bg-warm-gradient relative",
        currentTrack && playerMode === "bar" && "pb-24"
      )}
    >
      <Header variant="solid" />
      <FloatingOrbs variant="subtle" />

      <div className="relative z-10 pt-16">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Badge */}
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
              Coming Soon
            </span>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading">
              <span className="text-gradient">Marketplace</span>
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
              A place to browse and purchase meditation tracks from other
              creators, sell your own creations, and discover new artists in the
              mindfulness community.
            </p>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 pt-8">
              {FEATURES.map((feature) => (
                <GlassCard key={feature.title} hover="lift" className="text-left">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white mb-4",
                      feature.gradient
                    )}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-text mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {feature.description}
                  </p>
                </GlassCard>
              ))}
            </div>

            {/* CTA */}
            <div className="pt-8 space-y-4">
              <Link href="/builder">
                <GradientButton glow size="lg">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Your Track Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </GradientButton>
              </Link>
              <p className="text-sm text-muted">
                Start building — your tracks will be ready when the marketplace
                launches
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
