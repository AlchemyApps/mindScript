'use client'

import { useEffect, useState } from 'react'
import { Play, Pause, Volume2, Image as ImageIcon, FileText, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ContentReviewerProps {
  contentType: string
  contentId: string
}

interface TrackContent {
  id: string
  title: string
  description?: string
  audio_url?: string
  thumbnail_url?: string
  duration?: number
  user: {
    email: string
    display_name?: string
  }
  created_at: string
}

interface ProfileContent {
  id: string
  email: string
  display_name?: string
  bio?: string
  avatar_url?: string
  created_at: string
}

export function ContentReviewer({ contentType, contentId }: ContentReviewerProps) {
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetchContent()
  }, [contentType, contentId])

  useEffect(() => {
    // Cleanup audio on unmount
    return () => {
      if (audioElement) {
        audioElement.pause()
        audioElement.src = ''
      }
    }
  }, [audioElement])

  const fetchContent = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      switch (contentType) {
        case 'track': {
          const { data, error } = await supabase
            .from('tracks')
            .select(`
              *,
              user:profiles!user_id (
                email,
                display_name
              )
            `)
            .eq('id', contentId)
            .single()

          if (error) throw error
          setContent(data)
          break
        }

        case 'profile': {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', contentId)
            .single()

          if (error) throw error
          setContent(data)
          break
        }

        case 'seller_listing': {
          const { data, error } = await supabase
            .from('seller_profiles')
            .select(`
              *,
              user:profiles!user_id (
                email,
                display_name
              )
            `)
            .eq('id', contentId)
            .single()

          if (error) throw error
          setContent(data)
          break
        }

        // Add more content types as needed

        default:
          console.warn('Unsupported content type:', contentType)
      }
    } catch (error) {
      console.error('Error fetching content:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlayPause = () => {
    if (!content?.audio_url) return

    if (!audioElement) {
      const audio = new Audio(content.audio_url)
      audio.addEventListener('ended', () => setIsPlaying(false))
      setAudioElement(audio)
      audio.play()
      setIsPlaying(true)
    } else {
      if (isPlaying) {
        audioElement.pause()
        setIsPlaying(false)
      } else {
        audioElement.play()
        setIsPlaying(true)
      }
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-gray-600">Loading content...</p>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">Content not found</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Content Details</h3>

        {contentType === 'track' && (
          <div className="space-y-4">
            {/* Track Info */}
            <div className="flex items-start gap-4">
              {content.thumbnail_url ? (
                <img
                  src={content.thumbnail_url}
                  alt={content.title}
                  className="w-24 h-24 rounded-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="text-xl font-semibold">{content.title}</h4>
                {content.description && (
                  <p className="text-gray-600 mt-2">{content.description}</p>
                )}
                <div className="mt-3 text-sm text-gray-500">
                  <p>Created by: {content.user?.display_name || content.user?.email}</p>
                  <p>Duration: {content.duration ? `${Math.floor(content.duration / 60)}:${(content.duration % 60).toString().padStart(2, '0')}` : 'Unknown'}</p>
                  <p>Created: {new Date(content.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Audio Player */}
            {content.audio_url && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {isPlaying ? 'Playing...' : 'Click to play audio'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {content.tags && content.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {content.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {contentType === 'profile' && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {content.avatar_url ? (
                <img
                  src={content.avatar_url}
                  alt={content.display_name || content.email}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="text-xl font-semibold">
                  {content.display_name || 'Anonymous User'}
                </h4>
                <p className="text-gray-600">{content.email}</p>
                {content.bio && (
                  <p className="text-gray-700 mt-3">{content.bio}</p>
                )}
                <p className="text-sm text-gray-500 mt-3">
                  Joined: {new Date(content.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {contentType === 'seller_listing' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xl font-semibold">{content.display_name}</h4>
              {content.bio && <p className="text-gray-600 mt-2">{content.bio}</p>}
              <div className="mt-3 text-sm text-gray-500">
                <p>Seller: {content.user?.display_name || content.user?.email}</p>
                <p>Commission Rate: {content.commission_rate}%</p>
                <p>Status: {content.status}</p>
                <p>Created: {new Date(content.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Raw Data View (for debugging) */}
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            View Raw Data
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}