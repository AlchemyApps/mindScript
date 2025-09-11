import { Button } from "@mindscript/ui";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-surface">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded bg-primary"></div>
            <span className="text-xl font-semibold font-sora">MindScript</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-muted hover:text-text transition-colors">Features</a>
            <a href="#pricing" className="text-muted hover:text-text transition-colors">Pricing</a>
            <Button variant="ghost" size="sm">Sign In</Button>
            <Button size="sm">Get Started</Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-4xl">
            <h1 className="text-4xl md:text-6xl font-bold font-sora mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Program your inner voice
            </h1>
            <p className="text-xl text-muted mb-8 max-w-2xl mx-auto">
              Create personalized affirmation loops with AI voice and binaural sound. 
              Transform your mindset with the power of repetition and intention.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="px-8">
                Build your first loop — $1
              </Button>
              <Button variant="ghost" size="lg">
                Listen to examples
              </Button>
            </div>
          </div>
        </section>

        {/* Features Preview */}
        <section className="py-16 px-4 bg-surface">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold font-sora text-center mb-12">
              Everything you need to create powerful audio experiences
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">🎤</span>
                </div>
                <h3 className="font-semibold mb-2">AI Voices</h3>
                <p className="text-muted">Choose from premium OpenAI voices or create your own with ElevenLabs</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-accent/10 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">🎵</span>
                </div>
                <h3 className="font-semibold mb-2">Solfeggio & Binaural</h3>
                <p className="text-muted">Add healing frequencies and binaural beats for deeper impact</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-soft/20 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="font-semibold mb-2">Cross-Platform</h3>
                <p className="text-muted">Access your library on web and mobile with offline playback</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-surface py-8">
        <div className="container mx-auto px-4 text-center text-muted">
          <p>&copy; 2024 MindScript. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}