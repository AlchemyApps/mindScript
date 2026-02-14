'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Music, Check, AlertCircle, Loader2 } from 'lucide-react'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  trackId?: string
}

interface AudioUploaderProps {
  onUploadComplete?: (tracks: any[]) => void
  multiple?: boolean
  maxFiles?: number
  maxFileSize?: number // in MB
}

export default function AudioUploader({
  onUploadComplete,
  multiple = true,
  maxFiles = 10,
  maxFileSize = 50
}: AudioUploaderProps) {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const validateFile = (file: File): string | null => {
    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/x-m4a']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      return 'Invalid file type. Only audio files are allowed.'
    }

    // Check file size
    const maxBytes = maxFileSize * 1024 * 1024
    if (file.size > maxBytes) {
      return `File too large. Maximum size is ${maxFileSize}MB.`
    }

    return null
  }

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)

    // Check max files limit
    if (files.length + fileArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    const processedFiles: AudioFile[] = fileArray.map(file => {
      const error = validateFile(file)
      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: (error ? 'error' : 'pending') as AudioFile['status'],
        progress: 0,
        error: error || undefined,
      }
    })

    setFiles(prev => [...prev, ...processedFiles])
  }, [files.length, maxFiles, maxFileSize])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const uploadFile = async (audioFile: AudioFile) => {
    const formData = new FormData()
    formData.append('file', audioFile.file)

    // Add basic metadata
    const metadata = {
      title: audioFile.name.replace(/\.[^/.]+$/, ''),
      tags: ['uploaded'],
    }
    formData.append('metadata', JSON.stringify(metadata))

    try {
      // Update status to uploading
      setFiles(prev => prev.map(f =>
        f.id === audioFile.id
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ))

      const response = await fetch('/api/catalog/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()

      // Update status to success
      setFiles(prev => prev.map(f =>
        f.id === audioFile.id
          ? { ...f, status: 'success', progress: 100, trackId: data.track.id }
          : f
      ))

      return data.track
    } catch (error) {
      // Update status to error
      setFiles(prev => prev.map(f =>
        f.id === audioFile.id
          ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
          : f
      ))
      throw error
    }
  }

  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    const uploadedTracks = []

    for (const file of pendingFiles) {
      try {
        const track = await uploadFile(file)
        uploadedTracks.push(track)
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error)
      }
    }

    setIsUploading(false)

    if (uploadedTracks.length > 0 && onUploadComplete) {
      onUploadComplete(uploadedTracks)
    }
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'))
  }

  return (
    <div className="w-full">
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Music className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">
          Drag and drop audio files here, or click to browse
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Supported formats: MP3, WAV, OGG, M4A (max {maxFileSize}MB each)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple={multiple}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Select Files
        </button>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Files ({files.length}/{maxFiles})
            </h3>
            <div className="flex gap-2">
              {files.some(f => f.status === 'success') && (
                <button
                  onClick={clearCompleted}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear completed
                </button>
              )}
              <button
                onClick={uploadAll}
                disabled={isUploading || !files.some(f => f.status === 'pending')}
                className="bg-green-600 text-white px-4 py-1 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                Upload All
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {files.map(file => (
              <div
                key={file.id}
                className={`border rounded-lg p-4 ${
                  file.status === 'error'
                    ? 'border-red-300 bg-red-50'
                    : file.status === 'success'
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Music className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                      {file.error && (
                        <p className="text-xs text-red-600 mt-1">{file.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'pending' && (
                      <span className="text-xs text-gray-500">Pending</span>
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    {file.status === 'success' && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {file.status === 'uploading' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}