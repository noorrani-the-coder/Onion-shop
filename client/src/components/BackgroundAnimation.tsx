import React from 'react';

interface FloatingItem {
  id: number;
  icon: string;
  size: number;
  left: string;
  top: string;
  duration: number;
  delay: number;
  opacity: number;
  rotateDirection: number;
}

const FLOATING_ELEMENTS: FloatingItem[] = [
  { id: 1, icon: '🧅', size: 84, left: '6%', top: '12%', duration: 16, delay: 0, opacity: 0.35, rotateDirection: 1 },
  { id: 2, icon: '🥔', size: 78, left: '86%', top: '10%', duration: 19, delay: 1.5, opacity: 0.30, rotateDirection: -1 },
  { id: 3, icon: '🧄', size: 74, left: '12%', top: '42%', duration: 15, delay: 3, opacity: 0.32, rotateDirection: 1 },
  { id: 4, icon: '🧅', size: 92, left: '82%', top: '48%', duration: 22, delay: 0.8, opacity: 0.38, rotateDirection: -1 },
  { id: 5, icon: '🥔', size: 88, left: '20%', top: '72%', duration: 18, delay: 2.5, opacity: 0.32, rotateDirection: 1 },
  { id: 6, icon: '🧄', size: 80, left: '74%', top: '78%', duration: 17, delay: 4, opacity: 0.30, rotateDirection: -1 },
  { id: 7, icon: '🧅', size: 70, left: '46%', top: '22%', duration: 20, delay: 2, opacity: 0.25, rotateDirection: 1 },
  { id: 8, icon: '🥔', size: 72, left: '55%', top: '62%', duration: 21, delay: 5, opacity: 0.28, rotateDirection: -1 },
  { id: 9, icon: '🧄', size: 68, left: '90%', top: '32%', duration: 16, delay: 3.2, opacity: 0.28, rotateDirection: 1 },
  { id: 10, icon: '🧅', size: 82, left: '3%', top: '84%', duration: 23, delay: 1, opacity: 0.32, rotateDirection: -1 },
];

export const BackgroundAnimation: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Dynamic Mixed Dark & Light Blue Ambient Aurora / Glow Blobs */}
      <div
        className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-sky-500/25 rounded-full blur-[110px] animate-pulse"
        style={{ animationDuration: '7s' }}
      />
      <div
        className="absolute top-1/4 -right-32 w-[38rem] h-[38rem] bg-blue-600/30 rounded-full blur-[130px] animate-pulse"
        style={{ animationDuration: '10s', animationDelay: '2s' }}
      />
      <div
        className="absolute -bottom-36 left-1/3 w-[40rem] h-[40rem] bg-cyan-600/25 rounded-full blur-[140px] animate-pulse"
        style={{ animationDuration: '9s', animationDelay: '3.5s' }}
      />
      <div
        className="absolute top-2/3 right-1/4 w-[28rem] h-[28rem] bg-sky-400/20 rounded-full blur-[100px] animate-pulse"
        style={{ animationDuration: '8s', animationDelay: '1s' }}
      />

      {/* Large Floating Animated Onion, Garlic, and Potato Elements */}
      {FLOATING_ELEMENTS.map((item) => (
        <div
          key={item.id}
          className="absolute select-none transition-transform"
          style={{
            left: item.left,
            top: item.top,
            fontSize: `${item.size}px`,
            opacity: item.opacity,
            animation: `floatAround ${item.duration}s ease-in-out infinite`,
            animationDelay: `${item.delay}s`,
            filter: 'drop-shadow(0 12px 28px rgba(56, 189, 248, 0.45))'
          }}
        >
          {item.icon}
        </div>
      ))}
    </div>
  );
};
