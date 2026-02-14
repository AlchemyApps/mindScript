"use client";
import { useSearchParams } from "next/navigation";
import { Card } from "@mindscript/ui";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const trackId = searchParams.get("track_id");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center">
          {/* Email Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full">
              <Mail className="h-10 w-10 text-indigo-600" />
            </div>
          </div>

          {/* Verification Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Verify Your Email
          </h1>

          <p className="text-gray-600 mb-6">
            We've sent a confirmation email to:
          </p>

          {email && (
            <p className="font-semibold text-gray-900 mb-6 break-all">
              {email}
            </p>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-yellow-900 mb-2">Next Steps:</h3>
            <ol className="text-sm text-yellow-800 space-y-2 list-decimal list-inside">
              <li>Check your inbox for an email from MindScript</li>
              <li>Click the verification link in the email</li>
              <li>Return here to sign in and complete your purchase</li>
            </ol>
          </div>

          {/* Additional Info */}
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              Didn't receive the email? Check your spam folder or{" "}
              <button
                onClick={() => {
                  // TODO: Implement resend functionality
                  alert("Resend functionality will be implemented soon!");
                }}
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                click here to resend
              </button>
            </p>

            {trackId && (
              <p className="text-xs">
                Don't worry! Your track configuration has been saved and will be available after you verify your email.
              </p>
            )}
          </div>

          {/* Back to Home */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </div>
        </div>
      </Card>

      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[max(50%,25rem)] top-1/2 -translate-y-1/2 w-[128rem] h-[128rem] rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 opacity-20 blur-3xl" />
      </div>
    </div>
  );
}