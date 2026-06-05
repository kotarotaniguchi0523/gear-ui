"use client";

import { useState } from "react";
import { MOCK_PREVIEW_MIN_WIDTH } from "@/lib/preview";

/**
 * 二重バッファ方式のモックプレビュー。
 *
 * srcDoc を差し替えるたびに iframe をフルリロードすると、毎回 Tailwind CDN の
 * 再評価で一瞬スタイルが外れ、白フラッシュ（チカチカ）になる。ストリーミング中は
 * これが連続するため特に目立つ。
 *
 * そこで iframe を2枚（スロット0/1）用意する。
 *  - 表（front）スロット … 確定済み committedDoc を表示し続ける。
 *  - 裏（back）スロット  … 最新の srcDoc を非表示で読み込む。
 * 裏の読み込みが終わったら（onLoad）committedDoc を更新しつつ表裏を入れ替える。
 * 表になった iframe は既に描画済みなので、リロードを伴わず瞬時に差し替わり、
 * フラッシュしない。常に「裏で読み込み終わってから表に出す」ので途中が見えない。
 */
export function MockPreviewFrame({ srcDoc }: { srcDoc: string }) {
  const [front, setFront] = useState<0 | 1>(0);
  // 表スロットに表示し続ける、読み込み確定済みの内容。
  const [committedDoc, setCommittedDoc] = useState(srcDoc);

  // 表は確定済み、裏は最新の srcDoc を割り当てる。これにより裏スロットの iframe
  // だけが（非表示のまま）リロードされ、表スロットは再読み込みされない。
  const docFor = (idx: 0 | 1) => (idx === front ? committedDoc : srcDoc);

  const handleLoad = (idx: 0 | 1) => () => {
    if (idx === front) return; // 表側のロード（初期表示など）は入れ替え不要
    if (srcDoc === committedDoc) return; // 表に出ている内容と同じなら入れ替え不要
    // 裏に最新が描画し終わった → 確定して表へ昇格（＝表裏を入れ替え）
    setCommittedDoc(srcDoc);
    setFront(idx);
  };

  return (
    // デスクトップ相当の最小幅を確保し、狭いときは親の overflow-auto で横スクロール。
    <div className="relative h-full" style={{ minWidth: MOCK_PREVIEW_MIN_WIDTH }}>
      {([0, 1] as const).map((i) => (
        <iframe
          key={i}
          title={i === front ? "mock preview" : "mock preview (buffer)"}
          srcDoc={docFor(i)}
          onLoad={handleLoad(i)}
          aria-hidden={i !== front}
          className="absolute inset-0 w-full h-full bg-white block"
          style={{
            opacity: i === front ? 1 : 0,
            zIndex: i === front ? 1 : 0,
            pointerEvents: i === front ? "auto" : "none",
          }}
          sandbox="allow-scripts"
        />
      ))}
    </div>
  );
}
