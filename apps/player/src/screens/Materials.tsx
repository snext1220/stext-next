import { ASSET_BASE } from '../config.js';
import { MANUALS, SCENARIO_FORMAT_DOC, SOUNDTRACKS } from '../links.js';
import { href } from '../router.js';
import { DocPage, DocSheet, ExtLink } from './Doc.js';

/** キャラ画像素材集（ときのじさん）。assets/common/face/ */
const FACES: [file: string, name: string][] = [
  ['adol', 'アドル'],
  ['adol2', 'アド・ルー'],
  ['darkfact', 'ダルク＝ファクト'],
  ['dogi', 'ドギ'],
  ['fredy', 'フレディ王子'],
  ['kubla', 'クーブラ＝カーン'],
  ['rando', 'ランドー'],
  ['anna', 'アンナ'],
  ['orther', 'オーサー'],
  ['guran', 'グーラン'],
  ['venus', 'ビヌス'],
  ['bob', 'ボブ'],
  ['male_young_fighter2', 'ヤングファイター男2'],
  ['male_young_fighter3', 'ヤングファイター男3'],
  ['male_young_fighter4', 'ヤングファイター男4'],
  ['male_adult_fighter2', '中年ファイター男'],
  ['male_adult_dwarf2', 'アダルトドワーフ男'],
  ['female_young_elf2', 'ヤングエルフ女2'],
  ['female_young_elf3', 'ヤングエルフ女3'],
  ['female_young_elf4', 'ヤングエルフ女4'],
  ['female_young_wizard2', 'ヤングウィザード女'],
  ['pentawa_chara', 'ノーム'],
  ['hero_chara', 'ポーラス'],
  ['hero_chara2', 'グリメルム'],
];

/** 制作者向けの素材（旧サイトの For Creator）：BGM・キャラ画像の素材と、書き方の資料 */
export function Materials() {
  return (
    <DocPage
      page="materials"
      eyebrow="For Creator"
      title="制作者向けの素材"
      lede="シナリオ作りに使える BGM とキャラ画像の素材、そして書き方の資料をまとめました。"
    >
      <DocSheet seed={71}>
        <h3>BGM 素材（AZ さん）</h3>
        <p>
          SText の標準の BGM は、シナリオで自由に使えます。シーンの BGM に <code>@field05</code>{' '}
          のように、曲の名前に <code>@</code>{' '}
          を付けて指定するだけで、ファイルを同梱する必要はありません。どんな曲かは「
          <a href={href({ name: 'music' })}>音楽室</a>」で試聴できます。
        </p>
        <p>
          曲のファイルは SoundCloud
          でも公開しています（曲目の右端の［…］→［Download］からダウンロードできます）。
        </p>
        <ul>
          {SOUNDTRACKS.map((s) => (
            <li key={s.url}>
              <ExtLink href={s.url}>{s.title}</ExtLink>（{s.note}）
            </li>
          ))}
        </ul>
        <p className="doc-small">
          ※ SText 以外での利用は禁止とさせていただきます。ご了承ください。
        </p>

        <h3>キャラ画像素材集（ときのじさん）</h3>
        <p>
          プレイヤーキャラクターの画像は、シナリオごとに差し替えられます。自作の画像でもかまいませんが、「自作はちょっと……でも、いつもと雰囲気を変えてみたい！」という方のために、画像素材を集めました。画像を押すとダウンロードできます。
        </p>
        <p>
          差し替えるときは、シナリオの <code>meta.imageSet</code> を <code>&quot;custom&quot;</code>{' '}
          にして、<code>chara/</code> フォルダーに <code>性別_年齢_種族.png</code>（たとえば{' '}
          <code>male_young_fighter.png</code>
          ）の名前で画像を置きます。本文の挿絵（<code>capture/</code>）として使うこともできます。
        </p>
        <ul className="face-grid">
          {FACES.map(([file, name]) => (
            <li key={file}>
              <a href={`${ASSET_BASE}common/face/${file}.png`} download={`${file}.png`}>
                <img
                  src={`${ASSET_BASE}common/face/${file}.png`}
                  alt=""
                  width={100}
                  height={100}
                  loading="lazy"
                />
                <span>{name}</span>
              </a>
            </li>
          ))}
        </ul>

        <h3>書き方の資料</h3>
        <ul>
          <li>
            <ExtLink href={SCENARIO_FORMAT_DOC}>シナリオの形式（stext/2）の説明</ExtLink>
            ：シナリオのファイルを直接読み書きするときに。
          </li>
          <li>Playground のヘルプ：各欄の「？」から開けます。</li>
          <li>
            <ExtLink href={MANUALS.developer}>開発者向けマニュアル（目次）</ExtLink>・
            <ExtLink href={MANUALS.techniques}>開発者向け実践テクニック集</ExtLink>・
            <ExtLink href={MANUALS.playgroundFlow}>Playground Flow 編</ExtLink>
            ：旧サイトのころのマニュアルです。画面や記法が今とは違うところもありますが、シナリオ作りの考え方は今も参考になります。
          </li>
        </ul>
      </DocSheet>
    </DocPage>
  );
}
