/**
 * FloatWise Voice Synthesis Engine
 * Reads out restocking advice in Swahili or English for shopkeepers on the move.
 */

export class SpeechAdvisor {
  private static synth: SpeechSynthesis | null =
    typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis
      : null;

  public static isSupported(): boolean {
    return this.synth !== null;
  }

  public static speak(
    text: string,
    language: "en" | "sw" = "en",
    rate = 0.95,
    onEnd?: () => void
  ): boolean {
    if (!this.synth) return false;

    this.synth.cancel(); // Stop any currently playing utterance

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Pick best available voice for Swahili or East African English
    const voices = this.synth.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (language === "sw") {
      selectedVoice =
        voices.find((v) => v.lang.startsWith("sw") || v.lang.includes("KE")) ||
        voices.find((v) => v.name.toLowerCase().includes("swahili")) ||
        null;
      utterance.lang = "sw-KE";
    } else {
      selectedVoice =
        voices.find((v) => v.lang === "en-KE" || v.lang === "en-ZA" || v.lang === "en-GB") ||
        voices.find((v) => v.lang.startsWith("en")) ||
        null;
      utterance.lang = "en-KE";
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    this.synth.speak(utterance);
    return true;
  }

  public static stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public static pause(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  public static resume(): void {
    if (this.synth) {
      this.synth.resume();
    }
  }
}
