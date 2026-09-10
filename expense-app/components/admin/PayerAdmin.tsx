'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorBox, Loading } from '@/components/StateBox';
import { fetchJson, toErrorMessage } from '@/lib/client';
import type { Payer } from '@/lib/types';

// ============================================================
// 管理画面：立替者マスタの編集
//   追加 / 名前の変更 / 並び替え / 表示の切り替え / 削除ができる。
//   ※ これはこのアプリ専用のマスタ。
//     既存サイトのメニュー担当者のマスタとは別物で、
//     ここを直しても既存サイトには一切反映されない。
// ============================================================

type PayersResponse = { payers: Payer[] };

export default function PayerAdmin() {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [newName, setNewName] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<PayersResponse>('/api/payers');
      setPayers(res.payers);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function announce(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 4000);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetchJson<{ payer: Payer }>('/api/payers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setPayers((current) => [...current, res.payer]);
      setNewName('');
      announce(`「${res.payer.name}」を追加しました。`);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function patch(payer: Payer, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchJson<{ payer: Payer }>(`/api/payers/${payer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setPayers((current) => current.map((p) => (p.id === payer.id ? res.payer : p)));
    } catch (err) {
      setError(toErrorMessage(err));
      // 失敗したときは、画面を実際の中身に戻す
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function rename(payer: Payer) {
    const name = window.prompt('新しい名前を入力してください。', payer.name);
    if (name === null) return;
    if (!name.trim() || name.trim() === payer.name) return;
    await patch(payer, { name: name.trim() });
  }

  async function remove(payer: Payer) {
    if (
      !window.confirm(
        `「${payer.name}」を立替者マスタから削除します。\n` +
          'この人の過去の立替の記録は消えません（名前はそのまま残ります）。\n' +
          'よろしいですか？',
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetchJson<{ keptExpenses: number }>(`/api/payers/${payer.id}`, {
        method: 'DELETE',
      });
      setPayers((current) => current.filter((p) => p.id !== payer.id));
      announce(
        res.keptExpenses > 0
          ? `「${payer.name}」を削除しました。立替の記録 ${res.keptExpenses} 件はそのまま残っています。`
          : `「${payer.name}」を削除しました。`,
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, diff: number) {
    const target = index + diff;
    if (target < 0 || target >= payers.length) return;

    const next = [...payers];
    [next[index], next[target]] = [next[target], next[index]];
    setPayers(next); // 先に画面を動かして、あとからサーバーに反映する

    setBusy(true);
    setError(null);
    try {
      await fetchJson('/api/payers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
    } catch (err) {
      setError(toErrorMessage(err));
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function importFromSite() {
    if (
      !window.confirm(
        '既存サイト（メニュー特戦隊）の部員名を、このマスタに写します。\n' +
          '写すのは一度きりで、以後は連動しません。\n' +
          'すでに同じ名前が居る人は飛ばします。よろしいですか？',
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetchJson<{ added: number }>('/api/payers/import', { method: 'POST' });
      await load();
      announce(
        res.added > 0
          ? `${res.added}人を取り込みました。不要な人は削除してください。`
          : '取り込む人はいませんでした（すでに全員そろっています）。',
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {notice && (
        <p className="rounded-card border border-aqua-200 bg-aqua-50 px-3.5 py-2.5 text-[13px] font-bold text-aqua-700">
          {notice}
        </p>
      )}
      {error && <ErrorBox message={error} onRetry={() => void load()} />}

      {/* 追加 */}
      <form onSubmit={add} className="card flex gap-2 px-4 py-3.5">
        <input
          type="text"
          className="field"
          placeholder="追加する人の名前"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy || !newName.trim()}>
          追加
        </button>
      </form>

      {loading && <Loading label="立替者を読み込んでいます…" />}

      {!loading && payers.length === 0 && (
        <div className="rounded-card border border-line bg-line-soft/40 px-4 py-8 text-center">
          <p className="text-sm text-ink-faint">まだ立替者が登録されていません。</p>
          <button type="button" className="btn mt-3" disabled={busy} onClick={importFromSite}>
            既存サイトの部員名から取り込む
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {payers.map((payer, index) => (
          <li key={payer.id} className="card flex items-center gap-2 px-3.5 py-3">
            {/* 並び替え */}
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                className="rounded border border-line px-1.5 text-[11px] text-ink-faint tap disabled:opacity-30"
                onClick={() => void move(index, -1)}
                disabled={busy || index === 0}
                aria-label="上に移動"
              >
                ▲
              </button>
              <button
                type="button"
                className="rounded border border-line px-1.5 text-[11px] text-ink-faint tap disabled:opacity-30"
                onClick={() => void move(index, 1)}
                disabled={busy || index === payers.length - 1}
                aria-label="下に移動"
              >
                ▼
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-bold ${
                  payer.is_active ? 'text-ink' : 'text-ink-faint line-through'
                }`}
              >
                {payer.name}
              </p>
              <label className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
                <input
                  type="checkbox"
                  checked={payer.is_active}
                  disabled={busy}
                  onChange={(e) => void patch(payer, { is_active: e.target.checked })}
                />
                入力画面のプルダウンに出す
              </label>
            </div>

            <button
              type="button"
              className="btn shrink-0"
              disabled={busy}
              onClick={() => void rename(payer)}
            >
              名前
            </button>
            <button
              type="button"
              className="btn shrink-0 text-alert"
              disabled={busy}
              onClick={() => void remove(payer)}
            >
              削除
            </button>
          </li>
        ))}
      </ul>

      {payers.length > 0 && (
        <button type="button" className="btn w-full" disabled={busy} onClick={importFromSite}>
          既存サイトの部員名から取り込む（足りない人だけ追加）
        </button>
      )}
    </div>
  );
}
