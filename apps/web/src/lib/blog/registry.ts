import type { BlogPostMeta } from './types';

/**
 * Central registry of all blog posts.
 * Ordered newest-first. The /marketing skill writes entries here.
 */
export const blogPosts: BlogPostMeta[] = [
  {
    slug: 'how-affirmations-rewire-your-brain',
    title: 'How Affirmations Rewire Your Brain: The Neuroscience of Positive Self-Talk',
    excerpt:
      'Affirmations aren\'t just feel-good mantras. Neuroscience research reveals how repeated positive statements physically restructure neural pathways through neuroplasticity, when you do it right.',
    category: 'affirmations-self-talk',
    tags: [
      'affirmations',
      'neuroplasticity',
      'self-talk',
      'subconscious mind',
      'brain rewiring',
      'positive psychology',
      'habit formation',
    ],
    publishedAt: '2026-02-19T18:00:00Z',
    readTimeMinutes: 9,
    coverImage: '/images/blog/how-affirmations-rewire-your-brain.png',
    coverImageAlt: 'Neural pathways forming new connections inside a translucent human head, synapses firing with warm golden light',
    author: {
      name: 'MindScript',
      role: 'Editorial Team',
    },
    relatedLandingPage: '/',
    relatedSlugs: ['what-are-binaural-beats'],
    seo: {
      metaTitle: 'How Affirmations Rewire Your Brain: Neuroscience of Positive Self-Talk',
      metaDescription:
        'Discover how affirmations physically change your brain through neuroplasticity. Learn the research-backed method for effective self-talk, optimal timing, and graduated affirmation techniques.',
      keywords: [
        'how affirmations work',
        'affirmations neuroscience',
        'neuroplasticity affirmations',
        'positive self-talk science',
        'rewire your brain',
        'subconscious reprogramming',
        'affirmation techniques',
        'daily affirmations',
      ],
      focusKeyphrase: 'how affirmations rewire your brain',
    },
    faq: [
      {
        question: 'Do affirmations actually work scientifically?',
        answer:
          'Yes. fMRI studies published in Social Cognitive and Affective Neuroscience show that self-affirmation activates the ventromedial prefrontal cortex and ventral striatum, which are brain regions associated with positive self-valuation and reward processing. The key is using graduated affirmations your brain can accept as plausible, not unrealistic statements.',
      },
      {
        question: 'How long does it take for affirmations to rewire your brain?',
        answer:
          'Research suggests approximately 66 days of consistent daily repetition for a new thought pattern to become automatic. This aligns with the neuroplasticity timeline for synaptic strengthening. Short daily sessions (10-20 minutes) are more effective than occasional long ones.',
      },
      {
        question: 'When is the best time to listen to affirmations?',
        answer:
          'The two most effective windows are the first 20 minutes after waking and the last 20 minutes before sleep. During these transition periods, your brain moves through theta and alpha brainwave states when the subconscious mind is most receptive and the critical conscious filter is less active.',
      },
      {
        question: 'Are audio affirmations more effective than written ones?',
        answer:
          'Audio affirmations have advantages because they can be absorbed passively during optimal brain states (waking and sleeping transitions), they can be layered with supporting frequencies like binaural beats and solfeggio tones, and the voice quality itself impacts neural processing. Written affirmations are still effective but require active engagement.',
      },
    ],
  },
  {
    slug: 'solfeggio-frequencies-explained',
    title: 'Solfeggio Frequencies Explained: Ancient Tones, Modern Science',
    excerpt:
      'From 174 Hz to 963 Hz, solfeggio frequencies have been used for centuries to promote healing and well-being. Here\'s what each frequency does and what current research reveals about their effects.',
    category: 'sound-science',
    tags: [
      'solfeggio frequencies',
      '528 Hz',
      'healing frequencies',
      'sound healing',
      'frequency therapy',
      'meditation music',
      'psychoacoustics',
    ],
    publishedAt: '2026-02-19T15:00:00Z',
    readTimeMinutes: 8,
    coverImage: '/images/blog/solfeggio-frequencies-explained.png',
    coverImageAlt: 'Sacred geometry patterns merging with sound wave visualizations, golden ratio spirals with healing frequency vibrations',
    author: {
      name: 'MindScript',
      role: 'Editorial Team',
    },
    relatedLandingPage: '/',
    relatedSlugs: ['what-are-binaural-beats'],
    seo: {
      metaTitle: 'Solfeggio Frequencies Explained: Complete Guide to All 9 Healing Tones',
      metaDescription:
        'Learn what solfeggio frequencies are, the science behind 528 Hz and all 9 tones, and how to use them for stress relief, sleep, meditation, and focus. Complete guide with research.',
      keywords: [
        'solfeggio frequencies',
        'solfeggio frequencies explained',
        '528 Hz frequency',
        'healing frequencies',
        'sound healing science',
        '432 Hz vs 440 Hz',
        'frequency therapy',
        'solfeggio scale',
      ],
      focusKeyphrase: 'solfeggio frequencies explained',
    },
    faq: [
      {
        question: 'What are the 9 solfeggio frequencies?',
        answer:
          'The nine solfeggio frequencies are: 174 Hz (pain relief), 285 Hz (tissue repair), 396 Hz (releasing fear), 417 Hz (facilitating change), 528 Hz (transformation and DNA repair), 639 Hz (relationships), 741 Hz (self-expression), 852 Hz (spiritual awareness), and 963 Hz (higher consciousness). 528 Hz has the most scientific research supporting its effects.',
      },
      {
        question: 'Do solfeggio frequencies really work?',
        answer:
          'Research is promising but early-stage. The most studied frequency, 528 Hz, has been shown in peer-reviewed studies to reduce anxiety and cortisol levels compared to standard 440 Hz music. The broader principle that specific sound frequencies affect mood and physiology is well-supported by psychoacoustics research.',
      },
      {
        question: 'Do I need headphones for solfeggio frequencies?',
        answer:
          'No. Unlike binaural beats, solfeggio frequencies are direct tones that work through any audio output including speakers, headphones, or earbuds. Headphones may provide a more immersive experience, but they are not technically required for the frequencies to be effective.',
      },
      {
        question: 'What is the difference between solfeggio frequencies and binaural beats?',
        answer:
          'Solfeggio frequencies are specific fixed tones (e.g., 528 Hz) played directly, so you hear the actual frequency. Binaural beats create a perceived frequency from the difference between two tones sent to each ear separately (requiring headphones). They work through different mechanisms and are often used together in layered audio tracks.',
      },
    ],
  },
  {
    slug: 'what-are-binaural-beats',
    title: 'What Are Binaural Beats? The Science Behind Sound-Based Brain Training',
    excerpt:
      'Binaural beats use a subtle auditory illusion to guide your brainwaves into states of deep focus, relaxation, or sleep. Here\'s how they work and what the research actually says.',
    category: 'sound-science',
    tags: [
      'binaural beats',
      'brainwave entrainment',
      'focus',
      'sleep',
      'neuroscience',
      'brain training',
      'meditation',
    ],
    publishedAt: '2026-02-19T12:00:00Z',
    readTimeMinutes: 8,
    coverImage: '/images/blog/what-are-binaural-beats.png',
    coverImageAlt: 'Abstract visualization of binaural beat frequencies and brainwave patterns',
    author: {
      name: 'MindScript',
      role: 'Editorial Team',
    },
    featured: true,
    relatedLandingPage: '/',
    relatedSlugs: ['solfeggio-frequencies-explained', 'how-affirmations-rewire-your-brain'],
    seo: {
      metaTitle: 'What Are Binaural Beats? Science, Benefits & How to Use Them',
      metaDescription:
        'Learn how binaural beats work, what the neuroscience research says, and how to use brainwave entrainment for focus, sleep, and meditation. Complete guide with frequencies.',
      keywords: [
        'what are binaural beats',
        'binaural beats science',
        'brainwave entrainment',
        'binaural beats benefits',
        'binaural beats for focus',
        'binaural beats for sleep',
        'how do binaural beats work',
        'alpha waves',
        'theta waves',
        'delta waves',
      ],
      focusKeyphrase: 'what are binaural beats',
    },
    faq: [
      {
        question: 'Do binaural beats actually work?',
        answer:
          'Research shows binaural beats can influence brainwave activity through a process called neural entrainment. Multiple peer-reviewed studies demonstrate measurable effects on focus, anxiety reduction, and sleep quality, though individual results vary. The strongest evidence supports theta-range beats (4-8 Hz) for relaxation and alpha-range beats (8-14 Hz) for focus.',
      },
      {
        question: 'What frequency should I use for focus?',
        answer:
          'Alpha waves between 8-14 Hz are most associated with calm, focused attention. Beta waves (14-30 Hz) promote active concentration and alertness. For studying or deep work, try alpha-range binaural beats (10-12 Hz) paired with ambient background music.',
      },
      {
        question: 'Are binaural beats safe?',
        answer:
          'Binaural beats are generally considered safe for most people. However, those with epilepsy or seizure disorders should consult a doctor before use, as rhythmic auditory stimulation can potentially trigger seizures in susceptible individuals. Binaural beats are not a replacement for medical treatment.',
      },
      {
        question: 'Do I need headphones for binaural beats?',
        answer:
          'Yes, headphones or earbuds are required. Binaural beats work by sending slightly different frequencies to each ear, and your brain perceives the difference as a pulsing tone. Without headphones, both ears hear both frequencies and the effect is lost.',
      },
      {
        question: 'How long should I listen to binaural beats?',
        answer:
          'Most studies use sessions of 15-30 minutes. For sleep, start the audio 20-30 minutes before you want to fall asleep. For focus, a 15-minute session at the start of a work block can be effective. Consistency matters more than duration, and daily short sessions outperform occasional long ones.',
      },
    ],
  },
];
