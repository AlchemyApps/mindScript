import React from 'react';

interface SellerTemplateProps {
  name: string;
  avatar?: string;
  trackCount: number;
  followerCount?: number;
  rating?: number;
  bio?: string;
  verified?: boolean;
}

export function SellerTemplate({
  name,
  avatar,
  trackCount,
  followerCount = 0,
  rating = 0,
  bio,
  verified = false,
}: SellerTemplateProps) {
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
      {/* Background pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(240, 147, 251, 0.1) 0%, transparent 50%)
          `,
        }}
      />
      
      {/* Content container */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          padding: '80px',
          position: 'relative',
          alignItems: 'center',
          gap: '60px',
        }}
      >
        {/* Left side - Avatar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: '280px',
              height: '280px',
              borderRadius: '50%',
              background: avatar 
                ? `url(${avatar})` 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '4px solid rgba(102, 126, 234, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '120px',
              fontWeight: 700,
              color: 'white',
              position: 'relative',
            }}
          >
            {!avatar && name.charAt(0).toUpperCase()}
            
            {/* Verified badge */}
            {verified && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  width: '60px',
                  height: '60px',
                  background: '#667eea',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '4px solid #0f0f23',
                }}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="white"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="2" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Rating */}
          {rating > 0 && (
            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill={i < Math.floor(rating) ? '#fbbf24' : 'none'}
                  stroke={i < Math.floor(rating) ? '#fbbf24' : '#4b5563'}
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              <span style={{ color: '#94a3b8', fontSize: '20px', marginLeft: '8px' }}>
                {rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
        
        {/* Right side - Info */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Name with verified badge */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            {name}
          </div>
          
          {/* Bio */}
          {bio && (
            <div
              style={{
                fontSize: '28px',
                color: '#94a3b8',
                lineHeight: 1.4,
                marginBottom: '40px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {bio}
            </div>
          )}
          
          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: '60px',
            }}
          >
            {/* Tracks */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 700,
                  color: '#667eea',
                  lineHeight: 1,
                }}
              >
                {trackCount}
              </div>
              <div
                style={{
                  fontSize: '20px',
                  color: '#64748b',
                  marginTop: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Tracks
              </div>
            </div>
            
            {/* Followers */}
            {followerCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    color: '#764ba2',
                    lineHeight: 1,
                  }}
                >
                  {followerCount >= 1000 
                    ? `${(followerCount / 1000).toFixed(1)}k` 
                    : followerCount.toString()}
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    color: '#64748b',
                    marginTop: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}
                >
                  Followers
                </div>
              </div>
            )}
          </div>
          
          {/* CTA */}
          <div
            style={{
              marginTop: '40px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '16px 32px',
                borderRadius: '12px',
                fontSize: '24px',
                fontWeight: 600,
                color: 'white',
              }}
            >
              View Profile
            </div>
            <div
              style={{
                fontSize: '20px',
                color: '#64748b',
              }}
            >
              on MindScript
            </div>
          </div>
        </div>
      </div>
      
      {/* Logo watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          right: '60px',
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
          mindscript.app
        </span>
      </div>
    </div>
  );
}