import { getSupabaseAdmin, normalizeUrl } from '@/lib/supabase-server';
import { ASSIGNMENT_SELECT } from '@/lib/api-helpers';
import type {
  AssignmentView, Member, MenuFile, MenuFileView, Notice, Place, Release,
} from '@/lib/types';

// ============================================================
// 画面を最初に表示するときのデータ取得（サーバー側で実行）
//   環境変数が未設定のときは空配列を返し、ビルドや表示が落ちないようにする。
// ============================================================

export type InitialData = {
  members: Member[];
  places: Place[];
  assignments: AssignmentView[];
  configured: boolean;
  error: string | null;
};

export async function fetchInitialData(): Promise<InitialData> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { members: [], places: [], assignments: [], configured: false, error: null };
  }

  const [membersRes, placesRes, assignmentsRes] = await Promise.all([
    supabase.from('members').select('*').order('sort_order').order('created_at'),
    supabase.from('places').select('*').order('sort_order').order('created_at'),
    supabase.from('assignments').select(ASSIGNMENT_SELECT).eq('is_deleted', false).order('date'),
  ]);

  const error =
    membersRes.error?.message ?? placesRes.error?.message ?? assignmentsRes.error?.message ?? null;

  return {
    members: (membersRes.data ?? []) as Member[],
    places: (placesRes.data ?? []) as Place[],
    assignments: (assignmentsRes.data ?? []) as unknown as AssignmentView[],
    configured: true,
    error,
  };
}

/** 管理画面用：論理削除済みの割り当て一覧 */
export async function fetchDeletedAssignments(): Promise<AssignmentView[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('is_deleted', true)
    .order('date', { ascending: false });

  return (data ?? []) as unknown as AssignmentView[];
}

/** バージョン管理：更新履歴の一覧（新しい順） */
export async function fetchReleases(): Promise<Release[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from('releases')
    .select('*')
    .eq('is_deleted', false)
    .order('released_on', { ascending: false })
    .order('created_at', { ascending: false });

  return (data ?? []) as Release[];
}

/** 添付PDFを開くための URL を組み立てる */
export function menuFileUrl(storagePath: string): string {
  // 環境変数に /rest/v1 などのパスが混ざっていても、ホスト部分だけを使う
  const base = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? '';
  return `${base}/storage/v1/object/public/menus/${storagePath}`;
}

/** 練習日ごとのメニューPDF一覧（削除済みを除く） */
export async function fetchMenuFiles(): Promise<MenuFileView[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from('menu_files')
    .select('*')
    .eq('is_deleted', false)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  return ((data ?? []) as MenuFile[]).map((f) => ({ ...f, url: menuFileUrl(f.storage_path) }));
}

/** 管理画面用：削除済みのメニューPDF一覧 */
export async function fetchDeletedMenuFiles(): Promise<MenuFileView[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from('menu_files')
    .select('*')
    .eq('is_deleted', true)
    .order('date', { ascending: false });

  return ((data ?? []) as MenuFile[]).map((f) => ({ ...f, url: menuFileUrl(f.storage_path) }));
}

/** archive ページ用：メニューPDFと、その日の担当情報をまとめて取る */
export async function fetchArchiveData(): Promise<{
  files: MenuFileView[];
  assignments: AssignmentView[];
  members: Member[];
  places: Place[];
}> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { files: [], assignments: [], members: [], places: [] };

  const [filesRes, assignmentsRes, membersRes, placesRes] = await Promise.all([
    supabase
      .from('menu_files')
      .select('*')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('assignments').select(ASSIGNMENT_SELECT).eq('is_deleted', false),
    supabase.from('members').select('*').order('sort_order').order('created_at'),
    supabase.from('places').select('*').order('sort_order').order('created_at'),
  ]);

  return {
    files: ((filesRes.data ?? []) as MenuFile[]).map((f) => ({
      ...f,
      url: menuFileUrl(f.storage_path),
    })),
    assignments: (assignmentsRes.data ?? []) as unknown as AssignmentView[],
    members: (membersRes.data ?? []) as Member[],
    places: (placesRes.data ?? []) as Place[],
  };
}

/** お知らせ（表示中のものだけ。トップページ用） */
export async function fetchVisibleNotices(): Promise<Notice[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from('notices')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order')
    .order('created_at');

  return (data ?? []) as Notice[];
}

/** お知らせ（非表示も含めた全件。管理画面用） */
export async function fetchAllNotices(): Promise<Notice[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from('notices')
    .select('*')
    .order('sort_order')
    .order('created_at');

  return (data ?? []) as Notice[];
}
