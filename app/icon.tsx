import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          borderRadius: '80px',
        }}
      >
        <span
          style={{
            color: '#e8e0d0',
            fontSize: 240,
            fontWeight: 700,
            fontFamily: 'serif',
            letterSpacing: '-8px',
            lineHeight: 1,
          }}
        >
          IL
        </span>
      </div>
    ),
    { ...size },
  );
}
