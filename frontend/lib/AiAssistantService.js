import { voiceApi } from "../api/endpoints";

class AiAssistantService {
  constructor() {
    // Guard for SSR — window/speechSynthesis only exist in the browser.
    this.synth  = typeof window !== "undefined" ? window.speechSynthesis : null;
    this.voices = [];

    if (this.synth) {
      // Pre-load voices; some browsers populate async.
      this.voices = this.synth.getVoices();
      this.synth.onvoiceschanged = () => {
        this.voices = this.synth.getVoices();
      };
    }
  }

  speak(text) {
    if (!text || !this.synth) return;
    this.synth.cancel(); // Stop anything currently speaking.
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";

    // Pick a higher-quality voice if available.
    const englishVoices = this.voices.filter((v) => v.lang.startsWith("en"));
    if (englishVoices.length > 0) {
      const premiumVoice = englishVoices.find(
        (v) =>
          v.name.includes("Google") ||
          v.name.includes("Premium") ||
          v.name.includes("Natural"),
      );
      utterance.voice = premiumVoice || englishVoices[0];
    }
    this.synth.speak(utterance);
  }

  async processInput({ transcript, audioBlob, enableTTS = true }) {
    if (enableTTS) this.synth?.cancel();

    if (process.env.NODE_ENV === "development") {
      console.log("[AiAssistant] request:", { transcript, hasAudio: !!audioBlob });
    }

    const data = await voiceApi.process({ transcript, audioBlob });

    if (process.env.NODE_ENV === "development") {
      console.log("[AiAssistant] response:", data);
    }

    if (enableTTS) {
      if (data?.awaiting_confirm && data?.confirmation_prompt) {
        this.speak(data.confirmation_prompt);
      } else if (!data?.awaiting_confirm) {
        const replyText =
          data.answer ||
          data.message ||
          (data.target_entity ? `Saved as ${data.target_entity}.` : "Got it.");
        this.speak(replyText);
      }
    }
    return data;
  }

  async confirm(voiceEntryId, confirmed, enableTTS = true) {
    if (enableTTS) this.synth?.cancel();

    if (process.env.NODE_ENV === "development") {
      console.log(`[AiAssistant] confirm: id=${voiceEntryId} confirmed=${confirmed}`);
    }

    const data = await voiceApi.confirm(voiceEntryId, confirmed);

    if (process.env.NODE_ENV === "development") {
      console.log("[AiAssistant] confirm response:", data);
    }

    if (enableTTS) {
      if (!confirmed) {
        this.speak("Cancelled.");
      } else {
        const replyText =
          data.message ||
          (data.target_entity ? `Saved as ${data.target_entity}.` : "Done.");
        this.speak(replyText);
      }
    }
    return data;
  }
}

// Singleton — safe to import anywhere client-side.
// In SSR contexts the constructor guards with typeof window checks.
export const aiAssistant = new AiAssistantService();
