from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "baseten"          # "baseten" or "meta"

    baseten_api_key: str = ""
    baseten_base_url: str = "https://inference.baseten.co/v1"
    baseten_model: str = "meta-models/muse-spark-open-1026"

    meta_api_key: str = ""
    meta_api_base_url: str = "https://api.meta.ai/v1"
    meta_model_text: str = "muse-spark-1.3"

    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    elevenlabs_tts_model: str = "eleven_multilingual_v2"
    elevenlabs_stt_model: str = "scribe_v1"

    sim_runs: int = 10_000
    timezone: str = "Africa/Nairobi"

    def llm(self) -> tuple[str, str, str]:
        """(base_url, api_key, model) for the active provider."""
        if self.llm_provider == "baseten":
            return self.baseten_base_url, self.baseten_api_key, self.baseten_model
        if self.llm_provider == "meta":
            return self.meta_api_base_url, self.meta_api_key, self.meta_model_text
        raise ValueError(f"unknown LLM_PROVIDER: {self.llm_provider}")


settings = Settings()