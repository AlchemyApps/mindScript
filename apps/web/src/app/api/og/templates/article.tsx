import React from 'react';

interface ArticleTemplateProps {
  title: string;
  category: string;
  author: string;
  coverImage?: string;
}

export function ArticleTemplate({ title, category, author, coverImage }: ArticleTemplateProps) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: '#0f0f23',
        overflow: 'hidden',
      }}
    >
      {/* Cover image background */}
      {coverImage && (
        <img
          src={coverImage}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Dark overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: coverImage
            ? 'linear-gradient(to top, rgba(15, 15, 35, 0.95) 0%, rgba(15, 15, 35, 0.7) 50%, rgba(15, 15, 35, 0.5) 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #10B981 100%)',
          opacity: coverImage ? 1 : 0.25,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          flex: 1,
          padding: '60px 80px',
          position: 'relative',
        }}
      >
        {/* Category badge */}
        <div style={{ display: 'flex', marginBottom: '24px' }}>
          <div
            style={{
              background: 'rgba(108, 99, 255, 0.2)',
              border: '1px solid rgba(108, 99, 255, 0.5)',
              borderRadius: '999px',
              padding: '8px 24px',
              fontSize: '20px',
              color: '#a5b4fc',
              fontWeight: 600,
            }}
          >
            {category}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: '24px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </div>

        {/* Author */}
        <div
          style={{
            fontSize: '28px',
            color: '#a5b4fc',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a5b4fc"
            strokeWidth="2"
            style={{ marginRight: '12px' }}
          >
            <circle cx="12" cy="8" r="5" />
            <path d="M20 21a8 8 0 1 0-16 0" />
          </svg>
          {author}
        </div>
      </div>

      {/* Footer branding */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '80px',
          right: '80px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            MindScript Blog
          </span>
        </div>
        <span style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.5)' }}>
          mindscript.studio/blog
        </span>
      </div>
    </div>
  );
}
