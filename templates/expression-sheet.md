# Template: expression-sheet

表情差分シート用プロンプト雛形。
`characters/<id>/prompts/variants/expressions.md` の下敷き。

---

~~~markdown
# <キャラ名> — 表情シート

## 用途
同一顔での表情差分集（平常・喜・怒・哀・驚・決意）。
face-anchor を固定して顔の同一性を保つ。

## 依存ベースバージョン
v1

## 本文プロンプト
```
expression sheet of <character description>, bust-up framing,
six facial expressions on single sheet: neutral, smile, anger, sadness,
surprise, determined gaze, consistent face across all expressions,
neutral background
```

## ネガティブプロンプト
```
inconsistent face between cells, exaggerated cartoonish expressions,
text, watermark, background clutter, body props, extreme head angles
```

## Lexicon 参照
- lexicon/styles.md#ukiyo-e-edo
- lexicon/lighting.md#rim-light-soft
- lexicon/camera.md#centered-portrait

## メモ
- 必ず `references/images/face-anchor.png` をリファレンスとして使用すること。
- 表情は6種固定。追加する場合は別シートにする。
- 生成後、各表情のクロップを `references/images/expression-<name>.png` として保存可能（anchor ではない）。
~~~
