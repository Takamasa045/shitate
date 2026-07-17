# Template: three-view

三面図（正面・側面・背面）のキャラシート用プロンプト雛形。
`characters/<id>/prompts/variants/three-view.md` または `prompts/base.md` の下敷きに使う。

---

~~~markdown
# <キャラ名> — 三面図

## 用途
キャラクターシート（正面・側面・背面）の同時生成。顔・衣装・体格の同一性確認用。

## 依存ベースバージョン
v1

## 本文プロンプト
```
character sheet of <character description>, three-quarter orthographic views
showing front / side / back, neutral A-pose, full body visible,
consistent design across all three views, clean background,
<style reference>, <lighting reference>
```

## ネガティブプロンプト
```
inconsistent proportions between views, broken anatomy, extra limbs,
text, watermark, signature, blurry, multiple characters, props dominating frame
```

## Lexicon 参照
- lexicon/styles.md#ukiyo-e-edo
- lexicon/lighting.md#overcast-diffused
- lexicon/camera.md#three-quarter-orthographic

## メモ
- 三面図は **アンカー画像生成の起点**。このカットの品質が全バリアントの基礎になる。
- 背景は極力シンプルに。キャラ本体にフォーカスさせる。
- 生成後、正面カットを `references/images/face-anchor.png` として保存することを推奨。
~~~

---

## 使い方

1. このファイルをコピーして `characters/<id>/prompts/variants/three-view.md` に配置
2. `<character description>` をキャラの外観プロンプトに差し替え
3. `<style reference>`, `<lighting reference>` を `lexicon/` のエントリから選択
4. Lexicon 参照のリストも実際に使ったものに揃える
