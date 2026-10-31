import { ENGINE_VERSION } from '@stext/core';
import { SCENARIO_FORMAT } from '@stext/schema';
import { BrandTitle } from '@stext/ui';

/** Phase 1 の雛形。画面は Phase 4 でプロトタイプをもとに実装する */
export function App() {
  return (
    <main>
      <BrandTitle note="v2" />
      <p>
        エンジン {ENGINE_VERSION} / シナリオ形式 {SCENARIO_FORMAT}
      </p>
      <p>
        画面デザインは <a href="../../prototype/design/index.html">プロトタイプ</a>{' '}
        を参照してください。
      </p>
    </main>
  );
}
