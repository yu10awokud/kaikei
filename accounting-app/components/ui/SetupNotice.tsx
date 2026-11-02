import { ENV_MISSING_MESSAGE } from '@/lib/env';

// 環境変数が未設定のときに表示する案内
export default function SetupNotice() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="card p-6">
        <h1 className="mb-2 text-base font-bold text-ink">初期設定が必要です</h1>
        <p className="text-[14px] leading-relaxed text-ink-soft">{ENV_MISSING_MESSAGE}</p>
        <p className="mt-3 text-[13px] text-ink-faint">手順は accounting-app/README.md を参照してください。</p>
      </div>
    </div>
  );
}
