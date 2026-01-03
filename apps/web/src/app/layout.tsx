import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/providers/wagmi-provider';

export const metadata: Metadata = {
  title: 'C2C Agents - Web3 任务接单平台',
  description: 'C2C Web3 任务接单平台',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
