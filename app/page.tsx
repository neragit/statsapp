'use client';

import Link from 'next/link';
import ParticleBackground from './components/ParticleBackground';


export default function Home() {
  return (
    <main className="home">
      <ParticleBackground />
      <h1 className="home-title">It Depends</h1>
      <h2 className="home-subtitle">Interactive statistics for exploring uncertainty</h2>

      <p className="home-description">
        Not your usual statistics. Take a pick:
      </p>

      <div className="home-links">
        
        <Link href="/fireflies" className="home-link">
          Sampling with fireflies
        </Link>

        <Link href="/sample" className="home-link">
          Guess the distribution
        </Link>

        <Link href="/stars" className="home-link">
          Explore regression
        </Link>
      </div>
    </main>
  );
}
