import { siteImageUrl } from '../config.js';
import { CONTACTS } from '../links.js';
import { href } from '../router.js';

/** 全画面のフッター：CONTACT（旧サイトの CONTACT タブ）と、案内所・道具箱の読み物への近道 */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-in">
        <section aria-labelledby="contact-h">
          <h2 id="contact-h" className="eyebrow">
            Contact
          </h2>
          <ul className="contact-list">
            {CONTACTS.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noopener noreferrer">
                  <img src={siteImageUrl(c.icon)} alt="" width={40} height={40} loading="lazy" />
                  <strong>{c.title}</strong>
                </a>
                <p>{c.text}</p>
              </li>
            ))}
            <li>
              <a href={href({ name: 'library', quest: true })}>
                <img
                  src={siteImageUrl('contact/quest.png')}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                />
                <strong>シナリオへの感想・ご意見</strong>
              </a>
              <p>
                ぜひ、シナリオの作者にも感想やご意見をお寄せください。書庫でシナリオの詳細を開き、［アンケートに回答する］から送れます。
              </p>
            </li>
          </ul>
        </section>
        <nav className="footer-nav" aria-label="サイトの案内">
          <a href={href({ name: 'about' })}>ソーサリアン Text とは</a>
          <a href={href({ name: 'about', section: 'sorcerian' })}>ソーサリアンとは</a>
          <a href={href({ name: 'post' })}>シナリオを投稿する</a>
          <a href={href({ name: 'recruit' })}>募集中の企画</a>
          <a href={href({ name: 'links' })}>関連リンク</a>
          <a href={href({ name: 'gallery' })}>画廊</a>
          <a href={href({ name: 'staff' })}>作り手たち</a>
          <a href={href({ name: 'music' })}>音楽室</a>
          <a href={href({ name: 'materials' })}>制作者向けの素材</a>
        </nav>
        <p className="footer-copy">2017–, SORCERIAN Next Team</p>
      </div>
    </footer>
  );
}
