# Configuration settings for the application

import os

class Config:
    # API key for Meta's API
    META_API_KEY = os.getenv("META_API_KEY", "your_default_api_key_here")

    # Other configuration settings can be added here
    DEBUG = os.getenv("DEBUG", "False") == "True"
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///default.db")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")