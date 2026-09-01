import type { CostLeg, TranscriptItem, WordGoalResult } from '../types';

/** What the call screen needs from whichever engine is carrying the conversation.
 *  Two implement it: RealtimeCall (speech-to-speech over WebRTC) and TurnCall (the
 *  transcribe → think → speak cascade). The screen holds one of these and never asks
 *  which it has, apart from the turn controls that only one of them offers. */
export interface CallEngine {
  start(): Promise<void>;
  stop(): void;
  mute(m: boolean): void;
  /** The student opened a cheat sheet: stop listening, wait for them to come back. */
  pauseForMaterial(): void;
  resumeFromMaterial(): void;
  /** The student stepped away. Everything the call measures in conversation time stops
   *  with it: the mic closes, Odile is told to wait, the clock and the time nudges hold
   *  where they are, and the recorder takes nothing down. Paused time is not part of the
   *  call — it is neither billed nor counted against the minutes the format allows. */
  setPaused(p: boolean): void;
  /** 0..1 audio level for the avatar's mouth. */
  level(): number;
  seconds(): number;
  transcript(): TranscriptItem[];
  wordGoals(): WordGoalResult[];
  /** Raw mic recording for the post-call verbatim pass, or null when the engine has
   *  nothing to hand over (the turn engine transcribes as it goes and has no tail). */
  recording(): Promise<{ blob: Blob; seconds: number } | null>;
  /** Live transcription model actually in use, for the ledger. */
  transcribeModel(): string;
  /** Accumulated realtime token usage. Zeroed by engines that do not bill this way. */
  usage(): RealtimeUsage;
  /** Everything this engine spent, ready to be priced. Empty for RealtimeCall, whose
   *  usage() and call duration are what the ledger reads. */
  costEntries(): CostEntry[];
  /** The student's own words, verbatim, when the engine already has them (the turn
   *  engine transcribes every turn verbatim, so a second pass would pay twice for the
   *  same audio). Null when the engine has nothing better than its live captions. */
  verbatimText(): string | null;
  /** Turn engine only: end the student's turn now. */
  commitTurn?(): void;
  /** Turn engine only: stop Odile mid-sentence and start listening. */
  skipTurn?(): void;
}

export interface RealtimeUsage {
  input_tokens: number; output_tokens: number;
  audio_input_tokens: number; audio_output_tokens: number;
  cached_input_tokens: number; cached_audio_input_tokens: number;
}

/** One leg's raw usage, priced by the caller through lib/costs so the client ledger and
 *  the server ledger read the same table. */
export interface CostEntry {
  kind: CostLeg['kind'];
  model: string;
  entry: Record<string, unknown>;
}
