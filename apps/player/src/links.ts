/** 案内ページの読み物と CONTACT で使う外部のリンク */

/** GitHub Pages で公開するマニュアル */
export const MANUALS = {
  player: `${import.meta.env.BASE_URL}manual/player.html`,
  playground: `${import.meta.env.BASE_URL}manual/playground.html`,
  developer: 'https://sorcerian.hateblo.jp/entry/20171221',
  techniques: 'https://sorcerian.hateblo.jp/entry/20180429',
  playgroundFlow: 'https://sorcerian.hateblo.jp/entry/2019/05/03/211951',
  /** マニュアルの一覧 */
  index: `${import.meta.env.BASE_URL}manual/`,
};

/** シナリオの投稿先（GitHub Discussions のスレッドに返信する） */
export const POST_THREAD = 'https://github.com/snext1220/stext/discussions/299';

/** このリポジトリ */
export const REPOSITORY = 'https://github.com/snext1220/stext-next';

/** シナリオ形式（stext/2）の説明 */
export const SCENARIO_FORMAT_DOC = `${REPOSITORY}/blob/main/docs/scenario-format.md`;

/** BGM 素材（AZ さん。SoundCloud） */
export const SOUNDTRACKS = [
  {
    title: 'SORCERIAN Text Original Sound',
    note: '第1期（ドラゴンモードまで）',
    url: 'https://soundcloud.com/venus-az/sets/sorcerian-text-original-sounds/s-2tzI5',
  },
  {
    title: 'SORCERIAN Text Original Sound Vol.II',
    note: '第2期（ドラゴンモード以降）',
    url: 'https://soundcloud.com/az2nd/sets/sorcerian-text-original-soundtrack/s-NrBqCSP9vPF',
  },
];

/** CONTACT（全画面のフッター）。アンケートは書庫のシナリオの詳細から送る */
export const CONTACTS = [
  {
    icon: 'contact/twitter.png',
    title: 'X（旧 Twitter）',
    url: 'https://x.com/snext1220',
    text: 'ソーサリアン NText の公式アカウント。半人半 bot の王さまが、更新情報やどうでもいいことをつぶやいています。寂しがりやなので、絡むと喜びます。',
  },
  {
    icon: 'contact/manual.png',
    title: '公式マニュアル',
    url: MANUALS.index,
    text: 'プレイヤー向け・開発者向けのマニュアルです。遊び方や、シナリオの書き方を知りたいときに。',
  },
  {
    icon: 'contact/qa.png',
    title: '質問・要望箱',
    url: 'https://peing.net/ja/yy7512',
    text: 'NText への質問や機能のリクエストを、匿名で送れます。お返事は X の王さまから不定期に。',
  },
  {
    icon: 'contact/github.png',
    title: 'GitHub',
    url: REPOSITORY,
    text: 'NText のシステムは GitHub で開発しています。ご意見はもちろん、開発に参加したい方もこちらから。',
  },
] as const;
