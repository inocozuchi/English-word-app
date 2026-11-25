// 使えるデッキの一覧。新しいクイズ（文法など）は src/decks/<id>/ を作ってここに足す。
import type { Deck } from '../core/deck.ts';
import { etymologyDeck } from './etymology/deck.ts';

export const DECKS: Deck[] = [etymologyDeck];

export function getDeck(id: string): Deck {
  return DECKS.find((d) => d.id === id) ?? DECKS[0];
}
