# Spell API & CLI & Apps SDK インターフェース仕様 v1.0

## 1. 方針

外部から Spell を見る際には「Spell Engine API」として単純な面を提供し、内部の複雑さを隠蔽する。クライアント別の入口は ChatGPT (Apps SDK/MCP)、AI CLI/自製 CLI、汎用 HTTP API の 3 系統。

## 2. MCP / Apps SDK ツール（概念）

| ツール名 | 概要 | 主な引数 | 権限 |
| --- | --- | --- | --- |
| `spell.execute` | 指定呪文を実行 | `spell_id`, `inputs` | 一般 |
| `spell.list_spells` | 利用可能な呪文一覧 | なし | 一般 |
| `spell.estimate_cost` | 入力に対する料金見積 | `spell_id`, `inputs` | 一般 |
| `rune.create_spell` | 新しい呪文定義を登録 | `spec`, `code` | Rune |
| `admin.ban_user` | 指定ユーザーを BAN | `user_id`, `reason` | 管理者 |

Apps SDK にはユーザーロールを渡し、Spell 側で最終権限チェックを行う。

## 3. HTTP API 例

```http
POST /api/spell/execute
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "spell_id": "resize-image@v1",
  "inputs": {
    "image_url": "https://...",
    "width": 1024,
    "height": 768
  }
}
```

レスポンス例：

```json
{
  "status": "ok",
  "result": {
    "output_url": "https://..."
  },
  "usage": {
    "credits": 1.2
  }
}
```

Rune 用例：

```http
POST /api/rune/spells
Authorization: Bearer <user_token>

{
  "name": "my-custom-transform",
  "description": "...",
  "runtime": "wasm",
  "code": "...",
  "params_schema": { }
}
```

## 4. CLI UX

```bash
spell auth                     # ブラウザが開きパスキー登録
spell list                     # 利用可能な呪文一覧
spell run <spell-id> --input-file data.json
spell rune create --from spec.yml  # Rune ユーザーのみ
```

CLI は HTTP API の薄いラッパーとして設計し、Apps SDK と共通の権限モデルを使う。

