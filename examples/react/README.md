# example of local-storybook-vrt with React

`local-storybook-vrt` を React + Storybook プロジェクトで使うシンプルな例です。依存解決に `--legacy-peer-deps` は不要です。
（このリポジトリをローカルで使う場合は、ルートでも `npm install` を実行して `simple-git` 依存を解決してください。公開パッケージとして利用する場合は不要です。）

## 前提（最低バージョン）

- Node 20.19+（`@vitejs/plugin-react` / Vite 6 のエンジン要件に合わせています）
- Storybook 8.6.14 以上（例は `^8.6.14`）
- storycap 5.0.1 以上
- reg-suit 0.14.5 以上
- Vite 6 以上（例は `^6.0.11`、`@vitejs/plugin-react` は ^5 系を使用）

## 使い方

```bash
# Storybook
npm run storybook

# VRT: 現在のブランチ vs 指定ブランチでキャプチャ＆比較
npm run vrt -- <比較先ブランチ名>
```

キャプチャや reg-suit の作業ファイルは `.lvrt/` 配下に保存されます。
