export interface BrandTitleProps {
  /** タイトルの右に小さく添える文言 */
  note?: string;
}

/** 画面上部のロゴタイトル */
export function BrandTitle({ note }: BrandTitleProps) {
  return (
    <h1 className="stext-brand">
      SORCERIAN Text
      {note ? <small> {note}</small> : null}
    </h1>
  );
}
