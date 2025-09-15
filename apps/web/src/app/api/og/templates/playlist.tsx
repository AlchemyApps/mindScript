import React from 'react';

interface PlaylistTemplateProps {
  title: string;
  trackCount: number;
  totalDuration: string;
  coverImages?: string[];
  author?: string;
  description?: string;
}

export function PlaylistTemplate({
  title,
  trackCount,
  totalDuration,
  coverImages = [],
  author,
  description,
}: PlaylistTemplateProps) {
  // Generate placeholder colors if no images provided
  const placeholderColors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  ];
  
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
          background: 'linear-gradient(180deg, rgba(102, 126, 234, 0.1) 0%, rgba(15, 15, 35, 0.9) 100%)',
        }}
      />
      
      {/* Content container */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          padding: '60px',
          position: 'relative',
          gap: '60px',
        }}
      >
        {/* Left side - Cover grid */}
        <div
          style={{
            width: '400px',
            height: '400px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: '8px',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '100%',
                height: '100%',
                background: coverImages[i] 
                  ? `url(${coverImages[i]})` 
                  : placeholderColors[i],
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
              }}
            >
              {/* Overlay for better readability */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15, 15, 35, 0.2)',
                }}
              />
            </div>
          ))}
          
          {/* Center play button */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100px',
              height: '100px',
              background: 'rgba(15, 15, 35, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid rgba(102, 126, 234, 0.8)',
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
        
        {/* Right side - Playlist info */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Playlist badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a5b4fc"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 12h6M9 15h4" />
            </svg>
            <span
              style={{
                fontSize: '20px',
                color: '#a5b4fc',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Playlist
            </span>
          </div>
          
          {/* Title */}
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
          
          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: '24px',
                color: '#94a3b8',
                lineHeight: 1.4,
                marginBottom: '30px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </div>
          )}
          
          {/* Author */}
          {author && (
            <div
              style={{
                fontSize: '28px',
                color: '#a5b4fc',
                marginBottom: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ color: '#64748b' }}>by</span>
              {author}
            </div>
          )}
          
          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: '40px',
              paddingTop: '20px',
              borderTop: '2px solid rgba(102, 126, 234, 0.2)',
            }}
          >
            {/* Track count */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#667eea',
                  lineHeight: 1,
                }}
              >
                {trackCount}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  color: '#64748b',
                  marginTop: '8px',
                }}
              >
                {trackCount === 1 ? 'Track' : 'Tracks'}
              </div>
            </div>
            
            {/* Duration */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#764ba2',
                  lineHeight: 1,
                }}
              >
                {totalDuration}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  color: '#64748b',
                  marginTop: '8px',
                }}
              >
                Total Duration
              </div>
            </div>
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