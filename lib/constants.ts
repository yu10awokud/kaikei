// クライアント・サーバー両方から読む定数。
// lib/edit-auth.ts は node の crypto を import しているため、
// クライアント側から import できません。共有したい値はこちらに置きます。

export const EDIT_TOKEN_HEADER = "x-edit-token";
export const EDIT_TOKEN_STORAGE_KEY = "kaikei-edit-token";
