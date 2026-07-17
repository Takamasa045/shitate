import { mkdtemp, mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { atomicWriteFile } from "./atomic.ts";
import { pathExists } from "./character.ts";
import { CHARACTERS_DIR, characterDir } from "./paths.ts";

export const CHARACTER_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export class ScaffoldError extends Error {
  constructor(
    public readonly kind: "invalid-id" | "conflict" | "write-failed",
    message: string,
  ) {
    super(message);
    this.name = "ScaffoldError";
  }
}

export interface ScaffoldInput {
  id: string;
  name?: string;
  role?: string;
  force?: boolean;
  now?: Date;
}

export interface ScaffoldResult {
  id: string;
  dir: string;
  files: string[];
}

export async function scaffoldCharacter(input: ScaffoldInput): Promise<ScaffoldResult> {
  const id = input.id.trim();
  if (!CHARACTER_ID_RE.test(id)) {
    throw new ScaffoldError("invalid-id", "id must be ASCII kebab-case");
  }
  const name = singleLine(input.name?.trim() || id);
  const role = singleLine(input.role?.trim() || "TBD");
  const today = jstDate(input.now ?? new Date());
  const targetDir = characterDir(id);
  const contents = renderScaffold({ id, name, role, today });

  await mkdir(CHARACTERS_DIR, { recursive: true });
  if (await pathExists(targetDir)) {
    if (!input.force) {
      throw new ScaffoldError("conflict", `characters/${id}/ already exists`);
    }
    await writeScaffold(targetDir, contents);
    return { id, dir: targetDir, files: Object.keys(contents) };
  }

  const staging = await mkdtemp(resolve(CHARACTERS_DIR, `.${id}.staging-`));
  let committed = false;
  try {
    await writeScaffold(staging, contents);
    if (await pathExists(targetDir)) {
      throw new ScaffoldError("conflict", `characters/${id}/ already exists`);
    }
    await rename(staging, targetDir);
    committed = true;
    return { id, dir: targetDir, files: Object.keys(contents) };
  } catch (error) {
    if (error instanceof ScaffoldError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "ENOTEMPTY") {
      throw new ScaffoldError("conflict", `characters/${id}/ already exists`);
    }
    throw new ScaffoldError("write-failed", "character scaffold could not be written");
  } finally {
    if (!committed) await rm(staging, { recursive: true, force: true });
  }
}

async function writeScaffold(
  root: string,
  contents: Record<string, string>,
): Promise<void> {
  await Promise.all([
    mkdir(resolve(root, "prompts", "history"), { recursive: true }),
    mkdir(resolve(root, "prompts", "variants"), { recursive: true }),
    mkdir(resolve(root, "references", "images"), { recursive: true }),
    mkdir(resolve(root, "outputs"), { recursive: true }),
  ]);
  for (const [relativePath, content] of Object.entries(contents)) {
    await atomicWriteFile(resolve(root, relativePath), content);
  }
}

function renderScaffold(input: {
  id: string;
  name: string;
  role: string;
  today: string;
}): Record<string, string> {
  const base = renderBase({ name: input.name });
  return {
    "index.md": renderIndex(input),
    "prompts/base.md": base,
    "prompts/history/base.v1.md": base,
    "log.md": renderLog({ today: input.today }),
    "references/sources.yaml": renderSources(),
  };
}

function jstDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function renderIndex(input: {
  id: string;
  name: string;
  role: string;
  today: string;
}): string {
  return `---
id: ${input.id}
name: ${JSON.stringify(input.name)}
role: ${JSON.stringify(input.role)}
status: draft
base_version: v1
created: ${input.today}
updated: ${input.today}
source_entities: []
world_refs: []
relations: []
tags: []
---

# ${input.name}

## 概要

（1-3段落でキャラの核を書く。歴史・知識系なら source_entities を埋めて entity との対応を明記）

## 外観の核（Visual Core）

- **顔**:
- **体格**:
- **髪**:
- **特徴**:

## 性格・口調

（短く）

## 現在の制作状況

- 進行中のバリアント: なし
- 直近の課題: base.md を埋める / variant を追加する
- 次のマイルストーン: status を experimental に上げる

> 詳しい改善履歴は [log.md](./log.md) を参照。
> 現行プロンプトは [prompts/base.md](./prompts/base.md)。
`;
}

function renderBase(input: { name: string }): string {
  return `# ${input.name} — ベースプロンプト v1

## 用途
全生成カットの共通基盤。視覚的同一性を定義する。

## 依存ベースバージョン
v1

## 本文プロンプト
\`\`\`
(character visual description here)
\`\`\`

## ネガティブプロンプト
\`\`\`
text, watermark, signature, blurry, low quality, extra limbs, broken anatomy
\`\`\`

## Lexicon 参照
- （authoring reference。compile では variant 側の参照のみ使用）

## メモ
- \`pnpm forge new\` で生成したスキャフォールド。本文を埋めてから variant を追加する。
`;
}

function renderLog(input: { today: string }): string {
  return `# 育成ログ

新しい順（DESCENDING）で追記する。

## ${input.today} / base v1 / scaffold

- **試行**: \`forge new\` で骨組みを作成
- **プロンプト差分**: [prompts/base.md](prompts/base.md)
- **生成物**: （なし — scaffold のみ）
- **評価**: —
- **次の改善**: base.md の視覚コアを埋め、最初の variant を追加して compile する
`;
}

function renderSources(): string {
  return `# references registry
# role: anchor | style | pose | outfit | mood | seed
references: []
`;
}

function singleLine(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
}
