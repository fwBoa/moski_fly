import { Canvas } from '@/components/Game';

export default function Home() {
  // Set devMode=true to show the dev panel for tuning physics
  const devMode = process.env.NODE_ENV === 'development';

  return (
    <main className="fixed inset-0 overflow-hidden">
      <Canvas devMode={devMode} />
    </main>
  );
}
