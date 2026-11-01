import { PLAYGROUND_URL } from '../config.js';
import { POST_THREAD } from '../links.js';
import { href } from '../router.js';
import { DocPage, DocSection, type DocChapter } from './Doc.js';

const CHAPTERS = {
  create: { id: 'create', title: 'シナリオを作る' },
  submit: { id: 'submit', title: '投稿の手順' },
  folder: { id: 'folder', title: 'zip の中身' },
} satisfies Record<string, DocChapter>;

const FOLDER = `stext/ ……………………… シナリオのフォルダー
├─ scenario.json ……… シナリオ本体（Playground で保存したファイル）
├─ capture/ …………… 挿絵
│   ├─ intro.png …… 書庫で紹介する画像（120×180px）
│   └─ xxxxx.png …… 本文の画像（100KB 目安）
├─ bgm/ ………………… 独自の BGM（xxxxx.mp3、1MB 目安）
│   └─ se/ ………………… 独自の効果音（xxxxx.mp3、30KB 目安）
└─ chara/ ……………… 独自のキャラクター画像（100×100px。使うときだけ）`;

/** 投稿：シナリオの作り方と投稿の手順、zip の中身（旧サイトの作品投稿） */
export function Post({ section }: { section?: string }) {
  return (
    <DocPage
      page="post"
      section={section}
      eyebrow="Post"
      title="シナリオを投稿する"
      lede="ソーサリアン Text は、プレイヤーの皆さん一人ひとりが物語を紡ぎ、世界を創るプラットフォームです。新しいシナリオを、いつでも、いつまでも（！）募集しています。"
    >
      <DocSection page="post" chapter={CHAPTERS.create} eyebrow="Create" seed={53}>
        <p>
          皆に遊んでもらえるシナリオを手軽に形にしたい――と常々思っている方は、まずは SText
          で挑戦してみてはいかがでしょう。シナリオを書くための道具、資料、音楽素材などをそろえてお待ちしています。
        </p>
        <h3>Playground で書く</h3>
        <p>
          Playground
          は、ブラウザーで動くシナリオの編集環境です。インストールは要りません。シーンをフロー図の上でつなぎ、つなぎ替えながら、ゲームブックの流れを組み立てられます。フラグやアイテム、敵などは「定義」のタブで編集できます。書いたシナリオは、「試遊」のタブでその場で遊べます。
        </p>
        <p>
          テンプレートや公開中のシナリオを開いて、書き方を真似するところから始めるのもお勧めです。各欄の「？」から、書き方の説明（ヘルプ）を読めます。
        </p>
        <div className="end-actions">
          <a className="btn" href={PLAYGROUND_URL} target="_blank" rel="noopener noreferrer">
            Playground を開く
          </a>
          <a className="btn ghost" href={href({ name: 'materials' })}>
            素材と資料を見る
          </a>
        </div>
        <h3>旧形式のシナリオ</h3>
        <p>
          旧 Playground（Playground Flow／Editor）や旧形式（scenario.xml）で書いたシナリオは、「
          <a href={href({ name: 'convert' })}>変換所</a>
          」で新しい形式（stext/2）に変換して、そのまま遊んだり保存したりできます。保存したファイルは
          Playground で開いて、続きを書けます。
        </p>
      </DocSection>

      <DocSection page="post" chapter={CHAPTERS.submit} eyebrow="Submit" seed={59}>
        <ol className="doc-steps">
          <li>
            Playground
            でシナリオを書き、「試遊」で最後まで遊べるか確かめます。「検査」のタブに出た問題も直しておきましょう。
          </li>
          <li>
            ツールバーの「保存（JSON）」でシナリオをファイルに保存し、ファイルの名前を{' '}
            <code>scenario.json</code> に変えます。
          </li>
          <li>
            挿絵や独自の BGM があれば、「
            <a href={href({ name: 'post', section: 'folder' })}>zip の中身</a>
            」の形でフォルダーにまとめ、.zip に圧縮します。
          </li>
          <li>
            GitHub Discussions
            の投稿スレッドを開き、そこに載っているテンプレートに沿って必要な情報を書いて、スレッドへの返信として投稿します。.zip
            は、入力欄にドラッグ＆ドロップすると添付できます（GitHub のアカウントが必要です）。
          </li>
          <li>管理者が確認したあと、書庫に公開されます。公開まで、しばらくお待ちください。</li>
        </ol>
        <div className="end-actions">
          <a className="btn" href={POST_THREAD} target="_blank" rel="noopener noreferrer">
            GitHub から投稿する（要ログイン）
          </a>
        </div>
        <p className="doc-small">
          ※ Playground のツールバーの「投稿…」からも、編集中のシナリオと挿絵・BGM
          を直接投稿できます（旧 Playground Flow の［シナリオを投稿］と同じ投稿先です）。
        </p>
      </DocSection>

      <DocSection page="post" chapter={CHAPTERS.folder} eyebrow="Folder" seed={61}>
        <p>.zip は、次のフォルダー構成で作ってください。使わないフォルダーは要りません。</p>
        <pre className="doc-tree" aria-label="zip のフォルダー構成">
          {FOLDER}
        </pre>
        <ul>
          <li>
            SText の標準の BGM（<code>@field05</code>{' '}
            のように指定する曲）と効果音は、同梱しなくてかまいません。
          </li>
          <li>
            <code>intro.png</code> は、書庫の一覧と詳細に表示する、シナリオの顔となる画像です。
          </li>
          <li>
            <code>chara/</code> は、キャラクターの画像をシナリオ独自のものにするときだけ使います（「
            <a href={href({ name: 'materials' })}>キャラ画像素材集</a>
            」を参照）。
          </li>
        </ul>
      </DocSection>
    </DocPage>
  );
}
