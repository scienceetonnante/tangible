/** MIME types include codecs so browsers can make a reliable choice before download. */
export function mimeForAudio(src: string): string {
  if (src.endsWith(".m4a")) return 'audio/mp4; codecs="mp4a.40.2"';
  if (src.endsWith(".mp3")) return "audio/mpeg";
  if (src.endsWith(".webm")) return 'audio/webm; codecs="opus"';
  if (src.endsWith(".ogg")) return 'audio/ogg; codecs="opus"';
  return "audio/wav";
}

/** Select one supported artifact so a page never downloads every audio fallback. */
export function preferredAudioSource(
  sources: string[],
  canPlay: (mime: string) => string = (mime) => document.createElement("audio").canPlayType(mime),
): string {
  if (!sources.length) throw new Error("the lesson has no narration audio");
  const probably = sources.find((source) => canPlay(mimeForAudio(source)) === "probably");
  if (probably) return probably;
  const maybe = sources.find((source) => canPlay(mimeForAudio(source)) === "maybe");
  if (maybe) return maybe;
  throw new Error("this browser does not support the lesson audio formats");
}
