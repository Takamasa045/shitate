# Lexicon / Negatives（共通ネガティブプリセット）

複数キャラ・複数バリアントで繰り返し使う **ネガティブプロンプトの断片集**。
実運用から抽出したパターンを辞書化したもの。

## 使い方

このファイルのエントリは **執筆ガイド** である（compile には自動で組み込まれない）。
variant 作成時に必要な断片をコピーして、各ファイルの `## ネガティブプロンプト`
コードブロックに貼る。将来、compile への自動組み込みが必要になったら
AGENTS.md §4.5 / docs/schemas/compile.md の結合ルールを拡張する。

- 既存の `## Lexicon 参照` セクションには **記載しない**（ここのエントリは positive lexicon ではない）
- variant の `## メモ` に「`lexicon/negatives.md#clean-image` 由来」等と明記するのが推奨
- 断片はキャラ横断の共通資産なので、Shitate 全体の品質を下支えする層として機能する

---

## #clean-image

**用途**: テキストラベル・枠飾り・インフォグラフィック要素の混入を抑制する。
character sheet / expression sheet / pose sheet 等、generator が
レイアウト用のラベルを勝手に入れたがる用途で特に有効。

**ネガティブ断片**:
```
text labels on image, view labels, heading text, title text, captions,
decorative border, corner ornaments, frame decoration, infographic layout
```

**実績**: 複数の character sheet と pose sheet でラベル混入の抑制を確認。

**相性**: 全バリアント。ただし意図的に家紋や紋章を描かせたい場合は `corner ornaments` を外すこと。

---

## #no-anime-contamination

**用途**: ukiyo-e / 伝統的日本絵画スタイルを維持するために、アニメ的ハイライト・
極端な誇張・写実風陰影の混入を防ぐ。

**ネガティブ断片**:
```
anime highlights, exaggerated proportions, cartoon proportions,
photo realistic shading, shiny plastic skin, glossy eyes with multiple catchlights,
exaggerated muscles
```

**実績**: 複数の伝統絵画スタイルの run で、スタイルのブレを抑制。

**相性**: ukiyo-e を主軸とする全キャラ。`styles.md#storybook-watercolor` 等の
別スタイルを使うエントリでは一部除外が必要。

---

## #no-modern-contamination

**用途**: 古代〜中世日本を背景にしたキャラで、現代要素の混入を防ぐ。

**ネガティブ断片**:
```
modern clothing, western dress, jeans, t-shirt, sneakers,
zippers, buttons, velcro, wristwatch, eyeglasses,
fantasy plate armor, shiny chrome metal, pauldrons with spikes,
crown, jewelry chains
```

**実績**: 複数の歴史題材の run で、現代物と西洋装飾の混入を抑制。

**相性**: 和物・古代物全般。SF / 現代物キャラでは使わない。

---

## #no-multi-character-contamination

**用途**: 単キャラ描写で、意図しない群衆・仲間・敵兵の混入を防ぐ。
キャラ同一性の観点で特に重要（背景に他人が写ると主体がぼける）。

**ネガティブ断片**:
```
multiple characters, crowd in background, soldiers in frame,
men in frame, children in frame, bystanders,
enemy soldiers visible, party members
```

**実績**: 単独キャラクターの場面で、意図しない群衆の混入を抑制。

**相性**: 単キャラシーン全般。群衆シーンを意図する場合は外す。

---

## #regalia-orientation-lock

**用途**: 左右で異なる意味を持つ持ち物の向きを固定する。
image-to-image で参照画像を鏡像反転されるリスクを防ぐ。

**ネガティブ断片**:
```
orbs in wrong hands, black orb in left hand, white orb in right hand,
swapped regalia, mirrored pose, left-right flipped
```

**実績**: 左右非対称の小道具を持つ場面で機能。本文側でも左右を明示することと併用する。

**相性**: 左右非対称な持ち物を持つ全キャラ。

---

## エントリの追加ルール

新しいパターンを追加するときは:

1. **最低2つ以上のバリアント・キャラで実績がある** ことを条件にする
   （1 回きりの観察はここに来ない、variant 側に留める）
2. `**用途**` / `**ネガティブ断片**` / `**実績**` / `**相性**` の4セクションを埋める
3. 断片は **キャラ固有の名前や持ち物を含めない**
4. 断片は triple backtick のコードブロックに入れる
