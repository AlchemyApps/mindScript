import React from 'react';

interface TrackTemplateProps {
  title: string;
  artist: string;
  duration: string;
  category?: string;
  playCount?: number;
  backgroundImage?: string;
}

export function TrackTemplate({
  title,
  artist,
  duration,
  category = 'Meditation',
  playCount = 0,
  backgroundImage,
}: TrackTemplateProps) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: '#0f0f23',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
          opacity: 0.2,
        }}
      />
      
      {/* Content container */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Left side - Track info */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingRight: '40px',
          }}
        >
          {/* Category badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                background: 'rgba(102, 126, 234, 0.2)',
                border: '1px solid rgba(102, 126, 234, 0.5)',
                borderRadius: '999px',
                padding: '8px 20px',
                fontSize: '18px',
                color: '#a5b4fc',
                fontWeight: 600,
              }}
            >
              {category}
            </div>
          </div>
          
          {/* Track title */}
          <div
            style={{
              fontSize: '64px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.1,
              marginBottom: '20px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          
          {/* Artist */}
          <div
            style={{
              fontSize: '32px',
              color: '#a5b4fc',
              marginBottom: '40px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a5b4fc"
              strokeWidth="2"
              style={{ marginRight: '12px' }}
            >
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
            {artist}
          </div>
          
          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: '40px',
              fontSize: '24px',
              color: '#94a3b8',
            }}
          >
            {/* Duration */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                style={{ marginRight: '8px' }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {duration}
            </div>
            
            {/* Play count */}
            {playCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  style={{ marginRight: '8px' }}
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {playCount.toLocaleString()} plays
              </div>
            )}
          </div>
        </div>
        
        {/* Right side - Waveform visualization */}
        <div
          style={{
            width: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Waveform */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '200px',
            }}
          >
            {Array.from({ length: 30 }).map((_, i) => {
              const height = Math.random() * 100 + 50;
              const delay = i * 50;
              return (
                <div
                  key={i}
                  style={{
                    width: '8px',
                    height: `${height}px`,
                    background: `linear-gradient(180deg, #667eea ${100 - height/2}%, #764ba2 100%)`,
                    borderRadius: '4px',
                    opacity: 0.8,
                  }}
                />
              );
            })}
          </div>
          
          {/* Play button overlay */}
          <div
            style={{
              position: 'absolute',
              width: '100px',
              height: '100px',
              background: 'rgba(15, 15, 35, 0.9)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid rgba(102, 126, 234, 0.5)',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="#667eea"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Logo watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 100 100"
          fill="white"
          opacity="0.8"
        >
          <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="2" fill="none" />
          <path
            d="M 30 50 Q 50 30, 70 50 T 90 50"
            stroke="white"
            strokeWidth="3"
            fill="none"
          />
        </svg>
        <span style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
          MindScript
        </span>
      </div>
    </div>
  );
}