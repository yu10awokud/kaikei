"use client";

/**
 * 'use client' が付いたファイルは Client Component になります。
 *
 * Server Component（付いていないファイル）との使い分けの原則:
 *   - useState / useEffect / onClick など「状態やイベント」が要る → Client
 *   - DB から読むだけ / 秘密の環境変数を読む → Server
 *
 * このコンポーネントは sessionStorage を読み書きし、React の Context で
 * 「今 編集モードか」をアプリ全体に配ります。どちらもブラウザの仕事なので Client です。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { EDIT_TOKEN_HEADER, EDIT_TOKEN_STORAGE_KEY } from "@/lib/constants";

type EditModeContextValue = {
  /** 編集モードが解除されているか */
  enabled: boolean;
  /** sessionStorage の読み込みが済んだか（読み込み前の一瞬のチラつき防止に使う） */
  ready: boolean;
  /** 合言葉を送って解除する。失敗したらエラーメッセージを返す */
  unlock: (passphrase: string) => Promise<string | null>;
  /** 編集モードを解除（ロック）する */
  lock: () => void;
  /** 編集APIを叩くための fetch。トークンを自動で付ける */
  editFetch: (url: string, init?: RequestInit) => Promise<Response>;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // sessionStorage はサーバーには存在しないので、useEffect（＝ブラウザで描画された後）で読む。
  // useState の初期値で読もうとすると、サーバー側レンダリングでエラーになります。
  useEffect(() => {
    setToken(sessionStorage.getItem(EDIT_TOKEN_STORAGE_KEY));
    setReady(true);
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    const res = await fetch("/api/edit-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return (data as { error?: string }).error ?? "解除に失敗しました";
    }
    const { token: t } = (await res.json()) as { token: string };
    // sessionStorage はタブを閉じると消えます（localStorage は残る）。
    // 「部室の共用PCで開きっぱなし」を避けたいので sessionStorage を選んでいます。
    sessionStorage.setItem(EDIT_TOKEN_STORAGE_KEY, t);
    setToken(t);
    return null;
  }, []);

  const lock = useCallback(() => {
    sessionStorage.removeItem(EDIT_TOKEN_STORAGE_KEY);
    setToken(null);
  }, []);

  const editFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set("Content-Type", "application/json");
      if (token) headers.set(EDIT_TOKEN_HEADER, token);
      const res = await fetch(url, { ...init, headers });
      // サーバーが「トークンが違う」と言ってきたら、保存済みトークンを捨てる。
      // （合言葉を変更したのに古いトークンが残っている場合など）
      if (res.status === 401) lock();
      return res;
    },
    [token, lock],
  );

  const value = useMemo<EditModeContextValue>(
    () => ({ enabled: token !== null, ready, unlock, lock, editFetch }),
    [token, ready, unlock, lock, editFetch],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

/** 各画面から編集モードの状態を取り出すためのフック */
export function useEditMode(): EditModeContextValue {
  const ctx = useContext(EditModeContext);
  if (!ctx) {
    throw new Error("useEditMode は EditModeProvider の内側で使ってください");
  }
  return ctx;
}
