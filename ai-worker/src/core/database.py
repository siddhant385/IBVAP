from supabase import create_async_client
from supabase._async.client import AsyncClient
from src.core.config import settings

async def get_supabase_client() -> AsyncClient:
    """Returns an asynchronous instance of the Supabase client."""
    return await create_async_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
