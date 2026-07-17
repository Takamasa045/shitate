# Lexicon / Camera

カメラ・アングル・レンズの語彙。
PixVerse V6 ではプロンプト内でカメラワークを明示することが推奨（MEMORY.md 準拠）。
ズーム偏重禁止、最低 6 種のショットを使い分けること。

---

## #three-quarter-orthographic

**用途**: 三面図・キャラシート用の正面45度アングル。同一性確認カット向け。

**プロンプト断片**:
```
three-quarter orthographic view, neutral pose, character sheet framing,
full body visible, subject centered, flat perspective
```

**相性の良い Lexicon**:
- `styles.md#ukiyo-e-edo`
- `lighting.md#overcast-diffused`

**NG**:
- 極端なパース
- 被写界深度

---

## #low-angle-heroic

**用途**: 低アングルからの英雄的ショット。決めカット・導入に。

**プロンプト断片**:
```
low angle shot, subject looming against sky, 24mm wide lens,
heroic silhouette, slight upward tilt
```

**相性の良い Lexicon**:
- `lighting.md#golden-hour`
- `styles.md#ukiyo-e-edo`

**NG**:
- 真俯瞰
- 圧縮感の強い望遠

---

## #centered-portrait

**用途**: センター構図のバストアップ。表情シート・カットイン向け。

**プロンプト断片**:
```
centered portrait composition, 85mm equivalent lens, bust-up framing,
subject facing camera, neutral background
```

**相性の良い Lexicon**:
- `lighting.md#rim-light-soft`
- `styles.md#sumi-modern`

**NG**:
- オフセンター極端配置
- 広角歪み

---

## #tracking-side

**用途**: 横移動の追尾ショット。移動シーン・導線カットに。

**プロンプト断片**:
```
lateral tracking shot, camera moves parallel to subject,
full body in motion, medium lens, no zoom
```

**相性の良い Lexicon**:
- `settings/kaido.md#open-road`

**NG**:
- 固定ズームイン
- 手ブレ演出

---

## #over-shoulder

**用途**: 肩越し構図。対話シーン、対峙シーン、主観に近い視点に。

**プロンプト断片**:
```
over the shoulder shot, viewer positioned just behind the character's shoulder,
focus on what the character sees in front of them,
partial blur of shoulder and hair in foreground,
medium telephoto compression
```

**相性の良い Lexicon**:
- `styles.md#sumi-modern`
- `lighting.md#rim-light-soft`

**NG**:
- 正面構図
- 俯瞰
- 全身が見える広角

---

## #high-overhead

**用途**: 俯瞰（鳥瞰）ショット。群衆・広い場・地形・絵巻物風カット。

**プロンプト断片**:
```
high overhead bird's-eye view, looking down at the scene,
figures small within a wider composition,
no foreshortening artifacts, clean top-down angle,
classical emakimono cutaway roof perspective when indoors
```

**相性の良い Lexicon**:
- `styles.md#emaki-scroll`
- `settings/battlefield.md#mountain-pass`

**NG**:
- 人物の表情が主役のカット
- 接近したポートレート

---

## #dutch-angle

**用途**: 斜め傾斜構図。不安・混乱・転換点・緊張のシーンに限定的に使う。

**プロンプト断片**:
```
dutch tilt angle, camera rotated off horizontal axis,
subject framed diagonally, creating unease and tension,
cinematic tilt used sparingly for pivotal moments
```

**相性の良い Lexicon**:
- `lighting.md#torch-night`
- `styles.md#sumi-dry-brush`

**NG**:
- 静謐なシーン
- 通常の対話カット
- 連続使用（乱用すると効果が薄れる）
