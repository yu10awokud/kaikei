import type { Metadata } from "next";
import "./globals.css";
import { TabNav } from "@/components/TabNav";
import { EditModeButton } from "@/components/EditModeButton";
import { EditModeProvider } from "@/components/EditModeProvider";

/**
 * app/layout.tsx は全ページ共通の外枠です。
 * ページを移動しても、この中身は再描画されずに残ります。
 *
 * このファイル自身は Server Component（'use client' が無い）です。
 * その中に <EditModeProvider> という Client Component を置いています。
 * 「サーバーの中にクライアントを差し込む」のは OK ですが、逆は基本できません。
 * → だから Provider をレイアウトのできるだけ外側に置いて、
 *   その内側なら どのページからでも useEditMode() が使えるようにしています。
 */

export const metadata: Metadata = {
  title: "水泳部 プール予約管理",
  description: "プール予約・部の予定・会計タスクを管理する部内ツール",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-800">
        <EditModeProvider>
          <header className="no-print bg-sky-800">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-3">
              <h1 className="text-lg font-bold text-white">
                水泳部 プール予約管理
              </h1>
              <EditModeButton />
            </div>
            <div className="mx-auto max-w-6xl px-4 pt-2">
              <TabNav />
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </EditModeProvider>
      </body>
    </html>
  );
}
