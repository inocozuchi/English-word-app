<script lang="ts">
  // 分岐型の会話（定型ノード）。相手の発言 → 返答を選ぶ → 次の発言 … 終わりのノードで完了。
  // 自然な返答は複数あり、どれを選んでも成功。聞き返し（Could you say that again?）も成功の道で、
  // 相手はゆっくり言い直す（slow のノードは 0.75 倍）。途中の状態は保存して再開できる。
  import type { Scenario } from '../types.ts';
  import type { ConvState } from '../session.ts';
  import Speak from './Speak.svelte';
  import { speak } from '../../../core/speech.ts';
  import { modeSettings, store } from '../../../core/store.svelte.ts';
  import { compMode } from '../mode.ts';
  import { VOICE_LANGS } from '../settings.ts';
  import { haptic } from '../../../core/haptics.ts';

  let {
    scene,
    taskId,
    conv,
    done,
    onstep,
    ondone,
    onnext,
  }: { scene: Scenario; taskId: string; conv?: ConvState; done: boolean; onstep: (c: ConvState) => void; ondone: () => void; onnext: () => void } = $props();

  const s = $derived(modeSettings(compMode));
  const cur = $derived(conv?.taskId === taskId ? conv : { taskId, node: scene.startNode, path: [] });
  const node = $derived(scene.nodes.find((n) => n.id === cur.node));
  const finished = $derived(done || !!node?.terminal);
  let feedback = $state('');
  const say = (text: string, slow?: boolean) => speak(text, undefined, { rate: slow ? Math.min(0.75, s.rate) : s.rate, langs: VOICE_LANGS });

  // 相手の発言を読み上げる（ノードが変わるたび）
  let spoken = '';
  $effect(() => {
    const n = node;
    if (!n?.speaker || spoken === n.id + cur.path.length) return;
    spoken = n.id + cur.path.length;
    if (s.autoPlay && store.settings.audio) setTimeout(() => say(n.speaker!, n.slow), 250);
  });

  function choose(text: string, next: string, fb?: string) {
    feedback = fb ?? '';
    haptic('light');
    const nextState: ConvState = { taskId, node: next, path: [...cur.path, { node: cur.node, text }] };
    onstep(nextState);
    if (scene.nodes.find((n) => n.id === next)?.terminal) ondone();
  }
  /** これまでのやり取り（相手 → 自分） */
  const turns = $derived(cur.path.map((p) => ({ speaker: scene.nodes.find((n) => n.id === p.node)?.speaker ?? '', me: p.text })));
</script>

<div class="cv">
  <div class="top scroll">
    <p class="kind">会話の練習</p>
    <h3>{scene.title}</h3>
    <p class="goal">目的：{scene.goal}</p>
    <ol class="log">
      {#each turns as t}
        <li class="them en">{t.speaker}</li>
        <li class="me en">{t.me}</li>
      {/each}
      {#if node && !node.terminal && node.speaker}
        <li class="them en now">{#if node.slow}<span class="slow">ゆっくり</span>{/if}{node.speaker}<Speak text={node.speaker} size={32} rate={node.slow ? 0.75 : undefined} /></li>
      {/if}
    </ol>
    {#if feedback}<p class="fbk" aria-live="polite">{feedback}</p>{/if}
    {#if finished}<p class="ok">◯ 会話の目的を達成しました。聞き返しても、別の自然な返答でも大丈夫です。</p>{/if}
  </div>
  <div class="bottom">
    {#if finished}
      <button class="pri press" onclick={onnext}>次へ</button>
    {:else if node?.choices}
      <p class="ask">返答を選ぶ（どれも自然な返答。聞き返しても OK）</p>
      {#each node.choices as c}<button class="ch en press" onclick={() => choose(c.text, c.next, c.feedback)}>{c.text}</button>{/each}
    {/if}
  </div>
</div>

<style>
  .cv {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .top {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 6px 2px 16px;
  }
  .kind {
    font-size: 12px;
    font-weight: 800;
    color: var(--text2);
  }
  h3 {
    font-size: 22px;
    font-weight: 850;
  }
  .goal {
    font-size: 14px;
    color: var(--text2);
  }
  .log {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .log li {
    max-width: 88%;
    padding: 10px 14px;
    border-radius: 18px;
    font-size: 16px;
    line-height: 1.45;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .them {
    align-self: flex-start;
    background: var(--fill);
    border-bottom-left-radius: 6px;
  }
  .me {
    align-self: flex-end;
    background: var(--accent);
    color: var(--on-accent);
    border-bottom-right-radius: 6px;
  }
  .now {
    border: 2px solid var(--ink);
  }
  .slow {
    font-size: 11px;
    font-weight: 800;
    color: var(--text2);
  }
  .fbk {
    font-size: 13px;
    color: var(--accent);
    font-weight: 700;
  }
  .ok {
    font-size: 15px;
    font-weight: 800;
    color: var(--accent);
  }
  .bottom {
    flex: none;
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ask {
    font-size: 12px;
    color: var(--text2);
    font-weight: 700;
  }
  .ch {
    min-height: 52px;
    padding: 8px 16px;
    border-radius: 16px;
    border: 2px solid var(--ink);
    text-align: left;
    font-size: 16px;
    font-weight: 600;
  }
  .pri {
    min-height: 56px;
    border-radius: 18px;
    font-size: 16px;
    font-weight: 800;
    background: var(--accent);
    color: var(--on-accent);
    border: var(--frame) solid var(--ink);
  }
</style>
