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
};

export default nextConfig;
