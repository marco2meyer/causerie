import { useEffect, useState } from 'preact/hooks';
import { imgLoad } from '../lib/imgstore';

/** Async loader for a card's personal image (IndexedDB, Supabase fallback). Renders
 *  nothing until the image is available, so lists stay stable. */
export function CardImg({ id, cls }: { id: string; cls: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void imgLoad(id).then(s => alive && setSrc(s));
    return () => { alive = false; };
  }, [id]);
  return src ? <img class={cls} src={src} alt="" /> : null;
}
