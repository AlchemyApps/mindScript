"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle, ArrowRight, DollarSign, Calendar, Globe, Shield } from "lucide-react";

type OnboardingStatus = "idle" | "loading" | "checking" | "complete" | "incomplete" | "error" | "expired";

interface ConnectStatus {
  accountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
}

const benefits = [
  {
    icon: DollarSign,
    title: "85% Revenue Share",
    description: "Keep 85% of your sales revenue",
  },
  {
    icon: Calendar,
    title: "Weekly Payouts",
    description: "Get paid every Monday automatically",
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Sell to customers worldwide",
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Powered by Stripe for maximum security",
  },
];

const steps = [
  { id: 1, name: "Create Account", description: "Set up your seller profile" },
  { id: 2, name: "Verify Identity", description: "Confirm your identity for compliance" },
  { id: 3, name: "Add Bank Account", description: "Where you'll receive payouts" },
  { id: 4, name: "Start Selling", description: "List your tracks and earn" },
];

export default function SellerOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<OnboardingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);

  useEffect(() => {
    const action = searchParams.get("action");
    
    if (action === "return") {
      checkOnboardingStatus();
    } else if (action === "refresh") {
      setStatus("expired");
    }
  }, [searchParams]);

  const checkOnboardingStatus = async () => {
    setStatus("checking");
    try {
      const response = await fetch("/api/seller/connect");
      if (!response.ok) {
        if (response.status === 404) {
          setStatus("idle");
          return;
        }
        throw new Error("Failed to check status");
      }

      const data = await response.json();
      setConnectStatus(data);

      if (data.chargesEnabled && data.payoutsEnabled) {
        setStatus("complete");
        setTimeout(() => {
          router.push("/seller/dashboard");
        }, 2000);
      } else {
        setStatus("incomplete");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const startOnboarding = async () => {
    setStatus("loading");
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/seller/onboarding?action=return`;
      const refreshUrl = `${window.location.origin}/seller/onboarding?action=refresh`;

      const response = await fetch("/api/seller/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl, refreshUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to start onboarding");
      }

      const data = await response.json();
      setOnboardingUrl(data.onboardingUrl);
      
      // Redirect to Stripe onboarding
      window.location.href = data.onboardingUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start onboarding");
      setStatus("error");
    }
  };

  const continueOnboarding = async () => {
    if (onboardingUrl) {
      window.location.href = onboardingUrl;
    } else {
      startOnboarding();
    }
  };

  const formatRequirement = (requirement: string): string => {
    return requirement
      .split(".")
      .pop()
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()) || requirement;
  };

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking your account status...</p>
        </div>
      </div>
    );
  }

  if (status === "complete") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Onboarding Complete!</h2>
          <p className="mt-2 text-gray-600">Your seller account is now active. Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  if (status === "incomplete" && connectStatus) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
          <h2 className="mt-4 text-2xl font-bold text-center text-gray-900">Almost there!</h2>
          <p className="mt-2 text-center text-gray-600">
            Please complete the following requirements to activate your seller account:
          </p>

          <div className="mt-6 space-y-3">
            {connectStatus.requirementsCurrentlyDue.map((req, index) => (
              <div key={index} className="flex items-center p-3 bg-yellow-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3" />
                <span className="text-gray-700">{formatRequirement(req)}</span>
              </div>
            ))}
          </div>

          <button
            onClick={startOnboarding}
            className="mt-8 w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Complete Requirements
          </button>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
          <h2 className="mt-4 text-2xl font-bold text-center text-gray-900">Session expired</h2>
          <p className="mt-2 text-center text-gray-600">
            Your onboarding session has expired. Please continue to complete your setup.
          </p>

          <button
            onClick={continueOnboarding}
            className="mt-6 w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Continue Onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Become a MindScript Seller</h1>
        <p className="text-xl text-gray-600">Start earning by selling your meditation tracks</p>
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {benefits.map((benefit) => (
          <div key={benefit.title} className="bg-white rounded-lg shadow-sm p-6">
            <benefit.icon className="h-10 w-10 text-indigo-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{benefit.title}</h3>
            <p className="text-gray-600">{benefit.description}</p>
          </div>
        ))}
      </div>

      {/* Onboarding Steps */}
      <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">How it works</h2>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 font-semibold">
                  {step.id}
                </div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {step.id}. {step.name}
                </h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="h-5 w-5 text-gray-400 mt-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to start selling?</h2>
        <p className="text-indigo-100 mb-6">
          Join hundreds of creators earning on MindScript. Setup takes just 5 minutes.
        </p>

        {status === "loading" ? (
          <div className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mr-3"></div>
            Setting up your seller account...
          </div>
        ) : status === "error" ? (
          <div className="space-y-4">
            <p className="text-white">{error}</p>
            <button
              onClick={startOnboarding}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50"
            >
              Try Again
            </button>
          </div>
        ) : (
          <button
            onClick={startOnboarding}
            className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50 transition-colors"
          >
            Start Onboarding
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}