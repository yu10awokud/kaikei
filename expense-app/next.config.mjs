import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // このフォルダを単独のプロジェクトとして扱う。
  // （リポジトリの1つ上にも既存サイトの package.json があるため、
  //   これが無いと Next.js がそちらを基準にしてしまう）
  outputFileTracingRoot: here,

  // 以前は /expenses と /summary が別ページだったので、
  // そのURLをブックマークしていても開けるように転送する。
  async redirects() {
    return [
      { source: '/expenses', destination: '/?tab=expenses', permanent: false },
      { source: '/summary', destination: '/?tab=summary', permanent: false },
    ];
  },
};

export default nextConfig;
