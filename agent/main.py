import asyncio
import base64
import io
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import cv2
import numpy as np
import requests
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import google
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scogo.it.support.agent")

load_dotenv()

KNOWLEDGE_BASE_PATH = Path(os.getenv("KNOWLEDGE_BASE_PATH", "agent/knowledge_base"))
DEFAULT_SCREEN_CONTEXT = "Screen share inactive. No frames received yet."
BASE_INSTRUCTIONS = """
You are Scogo AI Support Assistant, an expert enterprise IT support specialist.

Conversation policy:
1. Start every session by greeting the user and asking for a concise description of their issue.
2. Listen to the user, restate the problem to confirm understanding, and gather any missing details.
3. Invite the user to share their screen as soon as it will help you diagnose the problem. If the current screen status indicates no recent frames, remind the user how to share their screen.
4. Only acknowledge that you can see the user's screen when the telemetry below confirms an active feed with fresh frames. Never guess about UI elements you cannot verify.
5. If the user claims that they shared their screen but the telemetry still shows no frames, politely ask them to try again and offer troubleshooting steps.
6. When the screen share is active, use the latest screen summary to ground your guidance in what is actually visible. Reference specific UI elements only if they appear in the summary.
7. Provide step-by-step instructions, pause after each step for confirmation, and keep a professional, friendly tone.
8. Summarize progress frequently and offer to escalate to a human technician if you cannot resolve the issue.
9. Be concise in your responses. Keep answers focused and avoid unnecessary elaboration.

Current screen telemetry:
{screen_context}
"""


@dataclass
class ScreenObservation:
    digest: Optional[str] = None
    captured_at: Optional[datetime] = None
    average_color: Optional[tuple[int, int, int]] = None
    variance: Optional[float] = None
    edge_density: Optional[float] = None
    screen_state: Optional[str] = None

    def to_prompt(self) -> str:
        if not self.captured_at:
            return "No recent screen frames available."

        age_seconds = max(
            0,
            int((datetime.now(timezone.utc) - self.captured_at).total_seconds()),
        )

        return f"Screen share ACTIVE. Last frame {age_seconds}s ago. {self.screen_state or 'Screen visible'}"


def load_knowledge_base() -> str:
    if not KNOWLEDGE_BASE_PATH.exists():
        logger.warning("Knowledge base path %s missing", KNOWLEDGE_BASE_PATH)
        return ""

    sections = []
    for file in KNOWLEDGE_BASE_PATH.glob("*.md"):
        sections.append(file.read_text())
    return "\n\n".join(sections)


def parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        # Ensure timezone awareness
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value).astimezone(timezone.utc)
    except ValueError:
        return None


def analyze_screen_frame_fast(image_base64: str) -> ScreenObservation:
    """
    Fast visual analysis without OCR.
    Analyzes screen frame using only RGB analysis and edge detection (~50ms).
    Returns simplified screen state based on visual complexity.
    """
    if not image_base64:
        return ScreenObservation()

    try:
        raw_bytes = base64.b64decode(image_base64)
    except (ValueError, TypeError):
        logger.warning("Failed to decode screen frame base64 payload")
        return ScreenObservation()

    try:
        image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except OSError:
        logger.warning("Unable to open screen frame as image")
        return ScreenObservation()

    # Fast visual analysis only - no OCR
    np_image = np.array(image)
    mean_rgb = tuple(int(x) for x in np_image.reshape(-1, 3).mean(axis=0))
    gray = cv2.cvtColor(np_image, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 60, 180)
    edge_density = float(edges.mean() / 255.0)
    variance = float(np.var(np_image))

    # Determine screen state based on visual complexity
    if edge_density > 0.15:
        screen_state = "Complex UI visible"
    elif edge_density > 0.05:
        screen_state = "UI elements visible"
    elif variance < 100:
        screen_state = "Blank or solid screen"
    else:
        screen_state = "Simple content visible"

    observation = ScreenObservation(
        average_color=mean_rgb,
        variance=variance,
        edge_density=edge_density,
        screen_state=screen_state,
    )
    return observation


class BackendClient:
    def __init__(self, base_url: str, api_key: Optional[str]) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def get_session_by_room(self, room_name: str) -> Optional[dict]:
        url = f"{self.base_url}/api/session/by-room/{room_name}"
        return await asyncio.to_thread(self._get_json, url)

    async def get_session(self, session_id: str, include_frame: bool = False) -> Optional[dict]:
        query = "?includeFrame=true" if include_frame else ""
        url = f"{self.base_url}/api/session/{session_id}{query}"
        return await asyncio.to_thread(self._get_json, url)

    def _get_json(self, url: str) -> Optional[dict]:
        try:
            response = requests.get(url, headers=self._headers(), timeout=3)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            logger.warning("Backend request failed for %s: %s", url, exc)
            return None


class ITSupportAgent(Agent):
    def __init__(self, knowledge_base: str) -> None:
        self._knowledge_base = knowledge_base
        self._screen_context = DEFAULT_SCREEN_CONTEXT
        super().__init__(instructions=self._build_instructions())

    def _build_instructions(self) -> str:
        instructions = BASE_INSTRUCTIONS.format(screen_context=self._screen_context)
        if self._knowledge_base:
            instructions += (
                "\nUse the following IT knowledge base when answering questions:\n"
                f"{self._knowledge_base}"
            )
        return instructions

    def update_screen_context(self, context: str) -> None:
        if context == self._screen_context:
            return
        self._screen_context = context
        self.instructions = self._build_instructions()
        logger.debug("Agent instructions updated with new screen context: %s", context)


class ScreenShareMonitor:
    def __init__(
        self,
        backend_client: BackendClient,
        agent: ITSupportAgent,
        poll_interval_seconds: float = 0.5,
    ) -> None:
        self._backend = backend_client
        self._agent = agent
        self._poll_interval = poll_interval_seconds
        self._task: Optional[asyncio.Task] = None
        self._session_id: Optional[str] = None
        self._last_digest: Optional[str] = None
        self._last_prompt: Optional[str] = None
        self._last_base_prompt: Optional[str] = None

    def start(self, session_id: str) -> None:
        self._session_id = session_id
        self._task = asyncio.create_task(self._run(), name="screen-share-monitor")
        logger.info("Screen share monitor started for session %s", session_id)

    async def _run(self) -> None:
        while True:
            if not self._session_id:
                await asyncio.sleep(self._poll_interval)
                continue
            try:
                response = await self._backend.get_session(self._session_id, include_frame=True)
                if response and "session" in response:
                    self._handle_session_response(response["session"])
            except Exception:  # noqa: BLE001
                logger.exception("Unexpected error while polling screen frames")
            await asyncio.sleep(self._poll_interval)

    def _handle_session_response(self, session: dict) -> None:
        screen = session.get("screenShare")
        if not screen:
            self._agent.update_screen_context("Screen share inactive. No frames have been received yet.")
            return

        captured_at = parse_iso_timestamp(screen.get("lastFrameAt"))
        digest = screen.get("lastFrameDigest")

        if not screen.get("active"):
            prompt = "Screen share inactive. Last successful frame received at "
            if captured_at:
                prompt += captured_at.astimezone(timezone.utc).strftime("%H:%M:%SZ UTC.")
            else:
                prompt += "an unknown time."
            if screen.get("framesReceived", 0) == 0:
                prompt += " No frames have ever been received for this session."
            self._agent.update_screen_context(prompt)
            self._last_prompt = prompt
            self._last_base_prompt = prompt
            return

        observation: Optional[ScreenObservation] = None
        if digest != self._last_digest:
            self._last_digest = digest
            frame_data = screen.get("lastFrame")
            observation = analyze_screen_frame_fast(frame_data) if frame_data else ScreenObservation()
            observation.digest = digest
            observation.captured_at = captured_at
        else:
            # reuse last prompt if still fresh
            if self._last_base_prompt:
                age_seconds = (
                    int((datetime.now(timezone.utc) - captured_at).total_seconds())
                    if captured_at
                    else "unknown"
                )
                refreshed_prompt = f"{self._last_base_prompt} Latest frame age: {age_seconds} seconds."
                self._agent.update_screen_context(refreshed_prompt)
                self._last_prompt = refreshed_prompt
                return

        if observation is None:
            observation = ScreenObservation()
            observation.captured_at = captured_at

        base_prompt = observation.to_prompt()
        if screen.get("framesReceived"):
            base_prompt += f" Total frames received: {screen['framesReceived']}."
        self._agent.update_screen_context(base_prompt)
        self._last_base_prompt = base_prompt
        self._last_prompt = base_prompt


async def entrypoint(ctx: JobContext):
    logger.info("Agent worker received job for room %s", ctx.room.name)

    # Connect with retry logic
    await connect_with_retry(ctx)

    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required to run the agent")

    os.environ["GOOGLE_API_KEY"] = gemini_api_key

    knowledge_base = load_knowledge_base()
    agent = ITSupportAgent(knowledge_base=knowledge_base)

    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            model=os.getenv("GEMINI_REALTIME_MODEL", "gemini-2.0-flash-exp"),
            voice=os.getenv("GEMINI_VOICE", "Puck"),
            temperature=float(os.getenv("GEMINI_TEMPERATURE", "0.6")),
        ),
    )

    await session.start(agent=agent, room=ctx.room)

    backend_base_url = os.getenv("BACKEND_BASE_URL")
    agent_api_key = os.getenv("AGENT_API_KEY")
    monitor: Optional[ScreenShareMonitor] = None

    if backend_base_url:
        backend_client = BackendClient(backend_base_url, agent_api_key)
        session_metadata = await backend_client.get_session_by_room(ctx.room.name)
        if not session_metadata:
            logger.warning(
                "Unable to locate session metadata for room %s. Screen monitoring disabled.",
                ctx.room.name,
            )
        else:
            session_id = session_metadata["session"]["sessionId"]
            monitor = ScreenShareMonitor(backend_client, agent)
            monitor.start(session_id)
    else:
        logger.warning("BACKEND_BASE_URL not configured. Screen monitoring disabled.")

    await session.generate_reply(
        instructions=(
            "Introduce yourself as Scogo AI Support Assistant, greet the user warmly, "
            "and ask them to describe the IT issue they are facing."
        )
    )

    await asyncio.Event().wait()


async def connect_with_retry(ctx: JobContext, max_attempts: int = 3, timeout: int = 30):
    """
    Connect to LiveKit room with retry logic and exponential backoff.

    Args:
        ctx: JobContext from LiveKit agent
        max_attempts: Maximum number of connection attempts (default: 3)
        timeout: Connection timeout in seconds (default: 30)

    Raises:
        RuntimeError: If all connection attempts fail
    """
    import time
    import random

    def calculate_backoff_delay(attempt: int) -> float:
        """Calculate exponential backoff delay with jitter."""
        base_delay = min(1.0 * (2 ** attempt), 4.0)  # 1s, 2s, 4s max
        jitter = base_delay * 0.25 * (random.random() - 0.5) * 2
        return base_delay + jitter

    def classify_error(error: Exception) -> str:
        """Classify error as transient or fatal."""
        error_str = str(error).lower()

        # Fatal errors (don't retry)
        fatal_patterns = [
            'unauthorized', 'forbidden', 'invalid token',
            'authentication', 'permission denied', 'not allowed'
        ]

        # Transient errors (retry possible)
        transient_patterns = [
            'network', 'timeout', 'connection', 'websocket',
            'refused', 'not found', 'temporary', 'unavailable'
        ]

        if any(pattern in error_str for pattern in fatal_patterns):
            return 'fatal'

        if any(pattern in error_str for pattern in transient_patterns):
            return 'transient'

        # Default to transient for unknown errors
        return 'transient'

    last_error = None

    for attempt in range(max_attempts):
        try:
            logger.info(f"Connection attempt {attempt + 1}/{max_attempts} for room {ctx.room.name}")

            # Attempt connection with timeout
            connection_task = asyncio.create_task(ctx.connect())
            await asyncio.wait_for(connection_task, timeout=timeout)

            logger.info(f"Successfully connected to room {ctx.room.name} on attempt {attempt + 1}")
            return  # Success

        except asyncio.TimeoutError as e:
            last_error = e
            logger.warning(f"Connection timeout on attempt {attempt + 1}/{max_attempts}")

            if attempt + 1 < max_attempts:
                delay = calculate_backoff_delay(attempt)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Connection timed out after {max_attempts} attempts")

        except Exception as e:
            last_error = e
            error_type = classify_error(e)
            logger.error(f"Connection error on attempt {attempt + 1}/{max_attempts}: {e} (type: {error_type})")

            if error_type == 'fatal':
                logger.error(f"Fatal error detected, aborting connection attempts: {e}")
                raise RuntimeError(f"Fatal connection error: {e}") from e

            if attempt + 1 < max_attempts:
                delay = calculate_backoff_delay(attempt)
                logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Connection failed after {max_attempts} attempts with transient errors")

    # All attempts failed
    raise RuntimeError(f"Failed to connect to room {ctx.room.name} after {max_attempts} attempts: {last_error}") from last_error


def validate_backend_config():
    """Validate BACKEND_BASE_URL configuration and connectivity."""
    backend_url = os.getenv("BACKEND_BASE_URL")

    if not backend_url:
        logger.warning("BACKEND_BASE_URL not set. Screen monitoring will be disabled.")
        return None

    # Validate URL format
    try:
        parsed = urlparse(backend_url)
        if not parsed.scheme or not parsed.netloc:
            logger.error(f"Invalid BACKEND_BASE_URL format: {backend_url}")
            return None
    except Exception as e:
        logger.error(f"Failed to parse BACKEND_BASE_URL: {e}")
        return None

    # Check if URL is reachable
    health_url = f"{backend_url.rstrip('/')}/health"
    logger.info(f"Checking backend health at: {health_url}")

    try:
        response = requests.get(health_url, timeout=5)
        if response.status_code == 200:
            logger.info("Backend health check passed")
            return backend_url
        else:
            logger.warning(f"Backend health check returned status {response.status_code}")
            return None
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to backend at {backend_url}. Screen monitoring will be disabled.")
        return None
    except requests.exceptions.Timeout:
        logger.warning(f"Backend health check timed out for {backend_url}")
        return None
    except Exception as e:
        logger.warning(f"Backend health check failed: {e}")
        return None


if __name__ == "__main__":
    livekit_url = os.getenv("LIVEKIT_HOST")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not all([livekit_url, livekit_api_key, livekit_api_secret]):
        raise RuntimeError("LIVEKIT_HOST, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set")

    os.environ["LIVEKIT_URL"] = livekit_url
    os.environ["LIVEKIT_API_KEY"] = livekit_api_key
    os.environ["LIVEKIT_API_SECRET"] = livekit_api_secret

    # Validate backend configuration at startup
    validated_backend_url = validate_backend_config()

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
