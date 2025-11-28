# local-storybook-vrt

ローカルの Storybook をブランチ間で起動し、storycap でキャプチャを取得、reg-suit で差分比較するための CLI です。  
`lvrt <別ブランチ>` を実行すると、現在のブランチと指定ブランチのキャプチャを `.lvrt` 以下に保存し、そのまま reg-suit で比較します。

## 必要環境

- Node.js 18+
- git（ブランチ切り替えに使用）
- ピア依存関係（各プロジェクトで devDependencies などに追加してください）
  - `storybook@^7`
  - `storycap@^3`
  - `reg-suit@^0.10`

## インストール

```bash
npm i -D local-storybook-vrt
```

## 使い方

```bash
lvrt <比較先ブランチ名>
```

1. 現在のブランチの Storybook をポート 6006 で起動し、`storycap` で `.lvrt/capture/<現在ブランチ>` に保存します。
2. 指定ブランチへ `git checkout` して同じ処理を行い、`.lvrt/capture/<指定ブランチ>` に保存します。
3. `.lvrt/reg-work/regconfig.json` を生成し、`npx reg-suit run` を実行して差分を算出します。
4. 処理後は元のブランチへ戻します。

## 環境変数

- `LVRT_PORT`: Storybook の起動ポート（デフォルト `6006`）
- `LVRT_STORYBOOK_COMMAND`: Storybook 起動コマンド（デフォルト `storybook dev`。例: `"start-storybook"`）
- `LVRT_STORYCAP_OPTIONS`: `storycap` にそのまま渡す追加オプション（例: `"--serverTimeout 120000"`）

## メモ

- `git` コマンドでブランチを切り替えるため、未コミットの変更がある場合は事前に退避してください。
- Storybook は `npx storybook dev`（もしくは環境変数で上書き）で起動します。各プロジェクト側で Storybook・storycap・reg-suit がインストールされている必要があります。
- キャプチャと reg-suit の作業ディレクトリは `.lvrt/` 配下にまとまります。必要に応じて `.gitignore` に登録してください。
