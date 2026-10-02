import type { Metadata } from 'next';
import './globals.css';
import StarBridgeLoader from '@/components/StarBridgeLoader';

export const metadata: Metadata = {
  title: 'StarBridge - Constellation',
  description: 'A private shared sky for two to bridge stars, grow a garden, and leave memories.',
  openGraph: {
    title: 'StarBridge - Constellation',
    description: 'A private shared sky for two to bridge stars, grow a garden, and leave memories.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><StarBridgeLoader/>{children}</body></html>;
}
