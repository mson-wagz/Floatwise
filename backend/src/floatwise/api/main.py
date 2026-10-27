from fastapi import FastAPI, HTTPException, Depends
from fastapi_jwt_auth import AuthJWT
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize FastAPI app
app = FastAPI()

# JWT Configuration
class Settings(BaseModel):
    authjwt_secret_key: str = os.getenv("JWT_SECRET")

@AuthJWT.load_config
def get_config():
    return Settings()