# Lexicon / Styles

アートスタイル語彙。キャラの見た目の骨格を決める層。

---

## #ukiyo-e-edo

**用途**: 江戸後期の浮世絵風スタイル。和物キャラの安定した土台。

**プロンプト断片**:
```
ukiyo-e woodblock print, edo period, limited color palette,
flat shading, fine line work, traditional Japanese composition,
hand-printed paper texture
```

**相性の良い Lexicon**:
- `lighting.md#rim-light-soft`
- `camera.md#three-quarter-orthographic`
- `clothing/wafuku.md#hakama-basic`

**NG**:
- リアルな陰影表現（photo realistic shading）
- 写真的被写界深度（bokeh, shallow depth of field）
- CG 的な金属反射

---

## #storybook-watercolor

**用途**: 柔らかい水彩調。日常シーン・風景寄りのカットに。

**プロンプト断片**:
```
ghibli-inspired watercolor, soft pastel palette, hand-painted background,
gentle line work, warm ambient light, cinematic frame composition
```

**相性の良い Lexicon**:
- `lighting.md#golden-hour`
- `settings/shrine.md#quiet-shrine`

**NG**:
- 硬いインクアウトライン
- ハイコントラストのネオン配色

---

## #sumi-modern

**用途**: 和モダン・墨絵寄りのミニマルスタイル。デザイン系カットに。

**プロンプト断片**:
```
minimal sumi ink illustration, bold brush strokes, negative space composition,
monochrome with single accent color, modern Japanese editorial aesthetic
```

**相性の良い Lexicon**:
- `lighting.md#rim-light-soft`
- `camera.md#centered-portrait`

**NG**:
- 細密なテクスチャ描写
- 派手な彩度

---

## #yamato-e

**用途**: 平安〜鎌倉期のやまと絵スタイル。貴族・宮廷・和歌文化系キャラに。
ukiyo-e より古く、豊かな色彩（群青・朱・金泥）と平面的な装飾性が特徴。

**プロンプト断片**:
```
yamato-e painting style, heian period aesthetic, rich mineral pigments,
azurite blue, cinnabar red, gold leaf accents,
flat decorative composition, fine line work with brush,
classical Japanese court painting tradition
```

**相性の良い Lexicon**:
- `lighting.md#golden-hour`
- `clothing/juunihitoe.md#heian-court`
- `settings/yashiki.md#heian-residence`

**NG**:
- 写実的な陰影表現
- 西洋遠近法
- 激しい筆致
- ukiyo-e の限定パレット（yamato-e はより彩度高い）

---

## #emaki-scroll

**用途**: 絵巻物スタイル。物語の継ぎ目のない横長構図、複数シーンを1枚に配置。
ストーリーテリングカット向け。

**プロンプト断片**:
```
japanese emakimono illustrated handscroll style, continuous horizontal composition,
fukinuki-yatai cutaway roof perspective, layered clouds separating scenes,
muted mineral pigments on aged paper, hand-drawn ink outlines,
classical kamakura or muromachi period aesthetic
```

**相性の良い Lexicon**:
- `lighting.md#overcast-diffused`
- `camera.md#high-overhead`
- `settings/yashiki.md#heian-residence`

**NG**:
- 縦長構図（絵巻は横長が本質）
- 一枚絵の単一シーン構成
- 立体的な透視図法

---

## #sumi-dry-brush

**用途**: 禅画・墨絵の乾筆スタイル。老練な武人・僧侶・一瞬の所作の表現に。

**プロンプト断片**:
```
zen ink painting with dry brush technique, hi-haku brushwork,
monochrome sumi ink on aged paper, rough textured strokes,
economy of line, single moment captured in minimal marks,
muromachi period zen aesthetic
```

**相性の良い Lexicon**:
- `lighting.md#rim-light-soft`
- `camera.md#centered-portrait`

**NG**:
- 色彩
- 細密な線描
- 装飾的な背景
