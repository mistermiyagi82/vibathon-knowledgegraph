import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, status
from fastapi.responses import JSONResponse
from graphiti_core import Graphiti
from graphiti_core.driver.kuzu_driver import KuzuDriver
from graphiti_core.nodes import EpisodeType
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


# ── Settings ──────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    openai_api_key: str
    kuzu_db_path: str = Field(default="../data/graphiti.db")
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

SettingsDep = Annotated[Settings, Depends(get_settings)]


# ── DTOs ──────────────────────────────────────────────────────────────────────

class AddEpisodeRequest(BaseModel):
    name: str
    episode_body: str
    source_description: str = "chat message"
    reference_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: EpisodeType = EpisodeType.message
    group_id: str | None = None  # use chat_id as group_id


class SearchQuery(BaseModel):
    query: str
    group_ids: list[str] | None = None
    max_facts: int = 10


class FactResult(BaseModel):
    uuid: str
    name: str
    fact: str
    valid_at: datetime | None
    invalid_at: datetime | None
    created_at: datetime
    expired_at: datetime | None


class SearchResults(BaseModel):
    facts: list[FactResult]


class Result(BaseModel):
    message: str
    success: bool


# ── Graphiti singleton ────────────────────────────────────────────────────────

_graphiti_instance: Graphiti | None = None


async def get_graphiti() -> Graphiti:  # type: ignore[return]
    if _graphiti_instance is None:
        raise RuntimeError("Graphiti not initialized")
    yield _graphiti_instance


GraphitiDep = Annotated[Graphiti, Depends(get_graphiti)]


# ── Background worker (fire-and-forget ingestion) ─────────────────────────────

class AsyncWorker:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.task: asyncio.Task | None = None

    async def _worker(self):
        while True:
            try:
                job = await self.queue.get()
                try:
                    await job()
                except Exception as e:
                    logger.error(f"Episode ingestion failed: {e}")
                finally:
                    self.queue.task_done()
            except asyncio.CancelledError:
                break

    async def start(self):
        self.task = asyncio.create_task(self._worker())

    async def stop(self):
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass


async_worker = AsyncWorker()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_: FastAPI):
    global _graphiti_instance
    settings = get_settings()

    driver = KuzuDriver(db=settings.kuzu_db_path, max_concurrent_queries=1)
    _graphiti_instance = Graphiti(graph_driver=driver)
    await _graphiti_instance.build_indices_and_constraints()
    logger.info(f"Graphiti ready — Kuzu DB at {settings.kuzu_db_path}")

    await async_worker.start()
    yield
    await async_worker.stop()
    await _graphiti_instance.close()


app = FastAPI(title="Graphiti Knowledge Graph Service", lifespan=lifespan)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/healthcheck")
async def healthcheck():
    return JSONResponse(content={"status": "healthy"}, status_code=200)


@app.post("/episodes", status_code=status.HTTP_202_ACCEPTED)
async def add_episode(request: AddEpisodeRequest, graphiti: GraphitiDep):
    """Ingest a message into the knowledge graph (async, fire-and-forget)."""
    async def task():
        await graphiti.add_episode(
            name=request.name,
            episode_body=request.episode_body,
            source=request.source,
            source_description=request.source_description,
            reference_time=request.reference_time,
            group_id=request.group_id,
        )
        logger.info(f"Episode ingested: {request.name} (group: {request.group_id})")

    await async_worker.queue.put(task)
    return Result(message="Episode queued for ingestion", success=True)


@app.post("/search", status_code=status.HTTP_200_OK)
async def search(query: SearchQuery, graphiti: GraphitiDep):
    """Hybrid search: semantic + keyword + graph traversal."""
    edges = await graphiti.search(
        query=query.query,
        group_ids=query.group_ids,
        num_results=query.max_facts,
    )
    facts = [
        FactResult(
            uuid=e.uuid,
            name=e.name,
            fact=e.fact,
            valid_at=e.valid_at,
            invalid_at=e.invalid_at,
            created_at=e.created_at,
            expired_at=e.expired_at,
        )
        for e in edges
    ]
    return SearchResults(facts=facts)
