/** Small MediaRecorder wrapper for the 4/3/2 retell and spoken card answers. */

export interface Rec {
  /** Stops and resolves with the recording. */
  stop(): Promise<Blob>;
  /** Stops and discards. */
  cancel(): void;
}

export async function startRec(): Promise<Rec> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm' : 'audio/mp4'; // iOS Safari records mp4/aac
  const mr = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mr.start(500);
  const release = () => stream.getTracks().forEach(t => t.stop());
  return {
    stop: () => new Promise<Blob>(resolve => {
      mr.onstop = () => { release(); resolve(new Blob(chunks, { type: mime })); };
      try { mr.stop(); } catch { release(); resolve(new Blob(chunks, { type: mime })); }
    }),
    cancel: () => { try { mr.stop(); } catch { /* already stopped */ } release(); }
  };
}
