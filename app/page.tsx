// src/app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="home">
      <h1 className="home-title">Welcome to StatsApp!</h1>

      <p className="home-description">
        Explore interactive statistical visualizations. Take a pick:
      </p>

      <div className="home-links">
        <Link href="/sample" className="home-link">
          Catch the bubbles to get a SAMPLE DISTRIBUTION
        </Link>

        <Link href="/fireflies" className="home-link">
          Sampling with fireflies!
        </Link>
      </div>
    </main>
  );
}
