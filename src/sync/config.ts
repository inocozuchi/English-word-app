// Firebase の接続設定（Firebase コンソール → プロジェクトの設定 → マイアプリ → ウェブ の firebaseConfig）。
// ここに入れておくと全端末で使える。空（null）のままでも、設定画面の「同期」に貼り付ければその端末で使える。
// Web 用の apiKey は公開してよい識別子（守りは firestore.rules）。手順は docs/firebase-sync.md
export const FIREBASE_CONFIG: Record<string, string> | null = {
  apiKey: 'AIzaSyDVIwT8ei0DkzULloSp7LB47cPgdCCEPuA',
  authDomain: 'eigo-loop.firebaseapp.com',
  projectId: 'eigo-loop',
  storageBucket: 'eigo-loop.firebasestorage.app',
  messagingSenderId: '119643236160',
  appId: '1:119643236160:web:f47889d5f50bf0ee647ca5',
};
