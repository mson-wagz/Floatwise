from pydantic_settings import BaseSettings, SettingsConfigDict

KNOWN_PROVIDERS = ("baseten", "fireworks", "meta")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_provider: str = "baseten"
    llm_chain: str = ""   # e.g. "baseten,fireworks,meta": tried in order if one fails

    baseten_api_key: str = ""
    baseten_base_url: str = "https://inference.baseten.co/v1"
    baseten_model: str = "meta-models/muse-spark-open-1026"

    fireworks_api_key: str = ""
    fireworks_base_url: str = "https://api.fireworks.ai/inference/v1"
    fireworks_model: str = "accounts/fireworks/models/muse-spark-open"

    meta_api_key: str = ""
    meta_api_base_url: str = "https://api.meta.ai/v1"
    meta_model_text: str = "muse-spark-1.3"

    sim_runs: int = 10_000
    timezone: str = "Africa/Nairobi"

    def llm_for(self, name: str) -> tuple[str, str, str]:
        """(base_url, api_key, model) for one provider."""
        if name == "baseten":
            return self.baseten_base_url, self.baseten_api_key, self.baseten_model
        if name == "fireworks":
            return self.fireworks_base_url, self.fireworks_api_key, self.fireworks_model
        if name == "meta":
            return self.meta_api_base_url, self.meta_api_key, self.meta_model_text
        raise ValueError(f"unknown provider '{name}'. Known: {', '.join(KNOWN_PROVIDERS)}")

    def llm(self) -> tuple[str, str, str]:
        """The active provider (what the smoke test reports)."""
        return self.llm_for(self.llm_provider)

    def chain(self) -> list[str]:
        names = [n.strip().lower()
                 for n in (self.llm_chain or self.llm_provider).split(",") if n.strip()]
        for n in names:
            if n not in KNOWN_PROVIDERS:
                raise ValueError(f"unknown provider '{n}'. Known: {', '.join(KNOWN_PROVIDERS)}")
        return names


settings = Settings()