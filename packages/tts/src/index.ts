// @tangible/tts — TTS provider adapters.
export { FakeTtsAdapter } from "./fake.js";
export { ElevenLabsAdapter, splitKeepingSeparators, type ElevenLabsOptions } from "./elevenlabs.js";
export { HuggingFaceVoiceAdapter, type HuggingFaceVoiceOptions } from "./huggingface-voice.js";
export { SupertonicTtsAdapter, type SupertonicOptions } from "./supertonic.js";
export {
  ensureSupertonicModel,
  supertonicModelDir,
  SUPERTONIC_MODEL_NAME,
  type SupertonicModelOptions,
} from "./supertonic-model.js";
