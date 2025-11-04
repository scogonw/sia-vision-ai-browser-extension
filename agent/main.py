import logging
import asyncio
import base64
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    WorkerOptions,
    cli,
    get_job_context,
)
from livekit.agents.llm import ImageContent
from livekit.plugins import google, noise_cancellation

logger = logging.getLogger("it-support-agent")

load_dotenv()


class ITSupportAgent(Agent):
    def __init__(self) -> None:
        self._tasks = []
        super().__init__(
            instructions="""
You are Scogo AI Support Assistant, an expert IT support specialist.

CAPABILITIES:
- You can see the user's screen in real-time through screen sharing
- You can hear the user's voice and understand their questions
- You have expertise in resolving common IT issues

YOUR ROLE:
1. Greet the user professionally and ask them to describe their issue
2. Analyze what you see on their screen to understand the problem
3. Identify the specific IT issue based on visual and verbal cues
4. Provide clear, step-by-step guidance to resolve the issue
5. Verify each step is completed before moving to the next
6. Be patient, encouraging, and professional at all times

GUIDANCE PRINCIPLES:
- Be specific: "Click the Start button in the bottom-left corner" not "Click Start"
- Wait for confirmation: "Have you clicked that button?" before proceeding
- Read error messages: If you see an error on screen, read it aloud and explain it
- Adapt your pace: If user seems confused, slow down and re-explain
- Use visual confirmation: "I can see you've opened the Settings window" to build confidence

COMMON ISSUES YOU CAN RESOLVE:
- Software installation and configuration
- Network connectivity problems
- Email and Outlook issues
- VPN connection setup
- Printer configuration
- Application crashes and errors
- Windows Update issues
- Password resets and account lockouts
- File sharing and permissions
- Browser configuration

ESCALATION:
If the issue is beyond your capability (hardware failure, critical system errors,
security breaches), inform the user and offer to create a ticket for human IT support.

COMMUNICATION STYLE:
- Professional but friendly
- Clear and concise
- Patient and encouraging
- Avoid technical jargon unless necessary
- Use analogies when explaining complex concepts
""",
            llm=google.beta.realtime.RealtimeModel(
                voice="Puck",
                temperature=0.7,
            ),
        )

    async def on_enter(self):
        def _image_received_handler(reader, participant_identity):
            task = asyncio.create_task(
                self._image_received(reader, participant_identity)
            )
            self._tasks.append(task)
            task.add_done_callback(lambda t: self._tasks.remove(t))
            
        get_job_context().room.register_byte_stream_handler("test", _image_received_handler)

        self.session.generate_reply(
            instructions="Greet the user professionally and ask them to describe their IT issue."
        )
    
    async def _image_received(self, reader, participant_identity):
        logger.info("Received image from %s: '%s'", participant_identity, reader.info.name)
        try:
            image_bytes = bytes()
            async for chunk in reader:
                image_bytes += chunk

            chat_ctx = self.chat_ctx.copy()
            chat_ctx.add_message(
                role="user",
                content=[
                    ImageContent(
                        image=f"data:image/png;base64,{base64.b64encode(image_bytes).decode('utf-8')}"
                    )
                ],
            )
            await self.update_chat_ctx(chat_ctx)
            print("Image received", self.chat_ctx.copy().to_dict(exclude_image=False))
        except Exception as e:
            logger.error("Error processing image: %s", e)


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    logger.info(f"Starting IT Support Agent in room: {ctx.room.name}")

    session = AgentSession()
    await session.start(
        agent=ITSupportAgent(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            video_enabled=True,
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    logger.info("IT Support Agent session started successfully")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
