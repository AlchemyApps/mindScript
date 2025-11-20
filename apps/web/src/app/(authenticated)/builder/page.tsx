'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BuilderForm } from './components/BuilderForm';
import { useAuth } from '@mindscript/auth/hooks';
import Link from 'next/link';

export default function BuilderPage() {
  const router = useRouter();
  const { user, session, loading } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [pricingInfo, setPricingInfo] = useState<{
    basePrice: number;
    discountedPrice: number;
    savings: number;
    isEligibleForDiscount: boolean;
  }>({ basePrice: 2.99, discountedPrice: 0.99, savings: 2.00, isEligibleForDiscount: false });

  // Redirect to login if not authenticated - with proper guards
  useEffect(() => {
    // Only redirect once, and only if we're done loading
    if (!loading && !user && !hasRedirected) {
      setHasRedirected(true);
      // Small delay to prevent race conditions
      const redirectTimer = setTimeout(() => {
        router.push('/auth/login?redirect=/builder');
      }, 100);
      return () => clearTimeout(redirectTimer);
    }
  }, [user, loading, hasRedirected, router]);

  // Fetch pricing eligibility when user is authenticated
  useEffect(() => {
    if (user) {
      fetchPricingEligibility();
    }
  }, [user]);

  const fetchPricingEligibility = async () => {
    try {
      const response = await fetch('/api/pricing/check-eligibility');
      if (!response.ok) {
        throw new Error('Failed to fetch pricing eligibility');
      }
      const pricingData = await response.json();

      setPricingInfo({
        basePrice: pricingData.pricing.basePrice / 100,
        discountedPrice: pricingData.pricing.discountedPrice / 100,
        savings: pricingData.pricing.savings / 100,
        isEligibleForDiscount: pricingData.isEligibleForDiscount
      });
    } catch (error) {
      console.error('Error fetching pricing eligibility:', error);
    }
  };

  const calculateTotal = (formData: any) => {
    let total = pricingInfo.isEligibleForDiscount ? pricingInfo.discountedPrice : pricingInfo.basePrice;
    // Note: BuilderForm sends 'music' not 'backgroundMusic'
    if (formData.music?.id && formData.music.id !== 'none') {
      // Add-on prices are hardcoded for now since form doesn't send them
      total += 0.99; // Background music add-on price
    }
    if (formData.solfeggio?.enabled) {
      total += 0.49; // Solfeggio add-on price
    }
    if (formData.binaural?.enabled) {
      total += 0.49; // Binaural add-on price
    }
    return total;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleSubmit = async (data: any) => {
    setIsCreating(true);

    try {
      // Calculate total with add-ons
      const total = calculateTotal(data);

      // Estimate duration based on script length (roughly 150 words per minute)
      const wordsPerMinute = 150;
      const wordCount = data.script ? data.script.split(/\s+/).length : 0;
      const estimatedDuration = Math.max(1, Math.ceil(wordCount / wordsPerMinute));

      // Prepare checkout data
      const checkoutData = {
        userId: user.id,
        builderState: {
          ...data,
          duration: estimatedDuration, // Add estimated duration
        },
        successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href,
        priceAmount: Math.round(total * 100), // Convert to cents
        firstTrackDiscount: pricingInfo.isEligibleForDiscount,
      };

      // Create checkout session
      const response = await fetch('/api/checkout/guest-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
      throw error;
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <>
      {/* Skip Navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        Skip to main content
      </a>
      
      <div className="min-h-screen bg-gray-50">
        {/* Breadcrumb Navigation */}
        <nav 
          className="bg-white shadow-sm border-b"
          aria-label="Breadcrumb"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <ol className="flex items-center space-x-2 text-sm">
                <li>
                  <Link 
                    href="/dashboard"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Dashboard
                  </Link>
                </li>
                <li className="text-gray-400">/</li>
                <li className="text-gray-900 font-medium">Builder</li>
              </ol>
            </div>
          </div>
        </nav>
        
        {/* Main Content */}
        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Track Builder</h1>
            <p className="mt-2 text-gray-600">
              Create your personalized audio experience with voice, music, and healing frequencies
            </p>
          </div>
          
          {/* Desktop Layout */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_300px] gap-8" data-testid="desktop-layout">
            <div>
              <BuilderForm onSubmit={handleSubmit} />
            </div>
            
            {/* Help Sidebar */}
            <aside 
              className="space-y-6"
              role="region"
              aria-label="Help"
            >
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">How to Create Your Track</h2>
                <ol className="space-y-3 text-sm text-gray-600">
                  <li className="flex">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-2">
                      1
                    </span>
                    <span>Write or paste your meditation script (10-5000 characters)</span>
                  </li>
                  <li className="flex">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-2">
                      2
                    </span>
                    <span>Select a voice from OpenAI, ElevenLabs, or upload your own</span>
                  </li>
                  <li className="flex">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-2">
                      3
                    </span>
                    <span>Choose background music or go without</span>
                  </li>
                  <li className="flex">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-2">
                      4
                    </span>
                    <span>Add Solfeggio or Binaural frequencies (optional)</span>
                  </li>
                  <li className="flex">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-2">
                      5
                    </span>
                    <span>Click "Create Audio" to generate your track</span>
                  </li>
                </ol>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Tips</h2>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Your draft is automatically saved every 10 seconds</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Use markdown formatting in your script for emphasis</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Preview voices before selecting</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Adjust music volume to -10dB for balanced audio</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-2">Keyboard Shortcuts</h2>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Save draft</dt>
                    <dd className="font-mono text-gray-900">⌘S / Ctrl+S</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
          
          {/* Mobile Layout */}
          <div className="lg:hidden" data-testid="mobile-layout">
            <BuilderForm onSubmit={handleSubmit} />
            
            {/* Mobile Help Section */}
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Need Help?</h2>
              <p className="text-sm text-gray-600">
                Create your track by writing a script, selecting a voice, choosing music, and adding frequencies. 
                Your draft is automatically saved.
              </p>
            </div>
          </div>
        </main>
        
        {/* Status Region for Screen Readers */}
        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
          className="sr-only"
        >
          {isCreating && <span>Creating audio job...</span>}
        </div>
      </div>
    </>
  );
}