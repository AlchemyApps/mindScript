"use client";

import { Button } from "@mindscript/ui";
import Link from "next/link";
import { Music, Download, Clock, PlayCircle } from "lucide-react";

export default function LibraryPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-sora mb-2">My Library</h1>
        <p className="text-gray-600">Your purchased and created tracks</p>
      </div>

      {/* Empty State */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Music className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Your library is growing</h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Your purchased tracks will appear here. Start building your collection of personalized affirmations and meditations.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button>Create a Track</Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="secondary">Browse Marketplace</Button>
          </Link>
        </div>
      </div>

      {/* TODO: Add actual library content when backend is ready */}
      {/* This would include:
        - List of purchased tracks
        - Download buttons
        - Play buttons
        - Track metadata (duration, created date, etc.)
      */}
    </div>
  );
}