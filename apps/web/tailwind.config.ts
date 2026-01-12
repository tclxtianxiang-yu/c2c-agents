import uiPreset from '@c2c-agents/ui/tailwind.preset';
import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [uiPreset as Config],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // 包含 packages/ui 的内容
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
};

export default config;
