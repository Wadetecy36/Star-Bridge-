import type { Metadata } from 'next';
import './globals.css';
import StarBridgeLoader from '@/components/StarBridgeLoader';

export const metadata: Metadata = { title: 'Constellation', description: 'A private shared sky for two.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><StarBridgeLoader/>{children}</body></html>;
}
