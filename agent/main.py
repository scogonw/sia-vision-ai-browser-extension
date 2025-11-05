import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    TurnDetection,
    WorkerOptions,
    cli,
)
from livekit.agents.llm import ChatContext
from livekit.plugins import google, noise_cancellation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scogo.it.support.agent")

load_dotenv()

KNOWLEDGE_BASE_PATH = Path(os.getenv("KNOWLEDGE_BASE_PATH", "agent/knowledge_base"))
DEFAULT_INSTRUCTIONS = """
You are Scogo AI Support Assistant, an expert enterprise IT support specialist.

1. Greet the user and collect a concise description of their issue.
2. Observe the user's shared screen to gather visual clues.
3. Provide step-by-step troubleshooting instructions and wait for confirmation after each step.
4. Speak in a friendly and professional tone, avoiding unnecessary jargon.
5. Summarize progress frequently and confirm resolution before ending the session.
6. Offer to escalate the issue to a human technician if you are unable to resolve it.
"""


def load_knowledge_base() -> str:
    if not KNOWLEDGE_BASE_PATH.exists():
        logger.warning("Knowledge base path %s missing", KNOWLEDGE_BASE_PATH)
        return ""

    sections = []
    for file in KNOWLEDGE_BASE_PATH.glob("*.md"):
        sections.append(file.read_text())
    return "\n\n".join(sections)


class ITSupportAgent(Agent):
    def __init__(self) -> None:
        knowledge_base = load_knowledge_base()
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is required to run the agent")

        google.configure(api_key=gemini_api_key)

        instructions = DEFAULT_INSTRUCTIONS
        if knowledge_base:
            instructions += "\nUse the following IT knowledge base when answering questions:\n" + knowledge_base

        llm = google.beta.realtime.RealtimeModel(
            model=os.getenv("GEMINI_REALTIME_MODEL", "models/gemini-1.5-pro-latest"),
            voice=os.getenv("GEMINI_VOICE", "Puck"),
            temperature=float(os.getenv("GEMINI_TEMPERATURE", "0.6")),
            instructions=instructions,
        )

        super().__init__(instructions=instructions, llm=llm)
        self.chat_ctx = ChatContext()

    async def on_enter(self) -> None:
        logger.info("Agent entering session")
        self.chat_ctx.add_message(
            role="system",
            content="Scogo AI Support Assistant ready to help."
        )
        self.session.generate_reply(
            instructions="Introduce yourself and ask the user to describe their IT issue."
        )

    async def on_user_message(self, message, participant):
        logger.info("User message received from %s", participant.identity)
        await super().on_user_message(message, participant)

    async def on_agent_transcript(self, transcript):
        logger.debug("Agent transcript: %s", transcript)


async def entrypoint(ctx: JobContext):
    logger.info("Agent worker received job for room %s", ctx.room.name)
    await ctx.connect()

    agent = ITSupportAgent()

    session = AgentSession(
        turn_detection=TurnDetection.VOICE,
    )
    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            video_enabled=True,
            audio_enabled=True,
            noise_cancellation=noise_cancellation.BVC(),
            vad_threshold=float(os.getenv("VAD_THRESHOLD", "0.6")),
        ),
    )

    await asyncio.Event().wait()


if __name__ == "__main__":
    livekit_url = os.getenv("LIVEKIT_HOST")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not all([livekit_url, livekit_api_key, livekit_api_secret]):
        raise RuntimeError("LIVEKIT_HOST, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set")

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            livekit_url=livekit_url,
            api_key=livekit_api_key,
            api_secret=livekit_api_secret,
        )
    )
