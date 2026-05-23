from typing import Any

from google import genai

from .conversation import local_reply


SYSTEM_TEXT = """
You are a highly helpful Hindi, Telugu, and English interactive voice bot named SwarSaathi, built and trained by Aman Kumar Pandey.
Your name is strictly SwarSaathi. Never refer to yourself as Gemini, Google, or anything else. 
If asked who you are or what your name is, reply: "Mera naam SwarSaathi hai" in Hindi, "Naa peru SwarSaathi" in Telugu, or "My name is SwarSaathi" in English.
If asked who made you, who trained you, or who built you, reply: "Mujhe Aman Kumar Pandey ne banaya aur train kiya hai" in Hindi, "Nannu Aman Kumar Pandey thayaaru chesi train chesaaru" in Telugu, or "I was built and trained by Aman Kumar Pandey" in English.
Reply in one short, conversational sentence.
Detect the user's primary language (Hindi vs Telugu vs English vs mixed) from their query and align your response language with it, ensuring natural grammar.

Ensure you do not mix words in a grammatically broken way (e.g., do not combine 'meeku' and 'kaise help chahiye' awkwardly as 'meeku kaise help chahiye?'. Instead, say 'aapko kaise help chahiye?' in Hindi, or 'meeku emi sahayam kavali?' in Telugu, or speak fluent English if the user addresses you in English).

If the user gives their name, remember and use it naturally with respect (e.g., using 'ji' or 'garu' naturally depending on language, or standard polite English address).
Handle greeting, help, demo, pricing, and scheduling.
Do not say that a demo is booked unless the user gives a date/time.
""".strip()


class GeminiReplyService:
    def __init__(self, api_key: str | None, model: str):
        self.model = model
        self.client = genai.Client(api_key=api_key) if api_key else None

    def generate(
        self,
        transcript: str,
        memory: dict[str, Any],
        history: list[dict[str, str]],
        response_script: str = "roman",
    ) -> tuple[str, str]:
        if self.client is None:
            return local_reply(transcript, memory, response_script), "rule"

        contents = self.build_prompt(transcript, memory, history, response_script)
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
            )
            reply = (response.text or "").strip()
            if reply:
                return reply, "gemini"
        except Exception:
            pass
        return local_reply(transcript, memory, response_script), "rule"

    def build_prompt(
        self,
        transcript: str,
        memory: dict[str, Any],
        history: list[dict[str, str]],
        response_script: str = "roman",
    ) -> str:
        user_name = memory.get("user_name") or "not given"
        turns = []
        for turn in history[-6:]:
            turns.append(f"User: {turn['user']}")
            turns.append(f"Bot: {turn['bot']}")

        history_text = "\n".join(turns) if turns else "No previous messages."
        
        # Select prompt constraints based on script configuration
        if response_script == "native":
            script_instruction = (
                "IMPORTANT SCRIPT RULE: You MUST write your reply in the NATIVE SCRIPT of the chosen language! "
                "For Hindi, use Devanagari script (e.g. 'नमस्ते, आपको क्या सहायता चाहिए?'). "
                "For Telugu, use Telugu script (e.g. 'నమస్తే, మీకు ఏమి సహాయం కావాలి?'). "
                "For English, use standard English (which is inherently written in Latin/Roman script)."
            )
        else:
            script_instruction = (
                "IMPORTANT SCRIPT RULE: You MUST write your reply using standard LATIN/ROMAN alphabets ONLY (Hinglish/Telglish/English)! "
                "For Hindi, write in Roman (e.g. 'Namaste, aapko kya help chahiye?'). "
                "For Telugu, write in Roman (e.g. 'Namaste, meeku emi sahayam kavali?'). "
                "For English, use standard English."
                "Do not use Devanagari or Telugu scripts."
            )

        return (
            f"{SYSTEM_TEXT}\n\n"
            f"{script_instruction}\n\n"
            f"Known user name: {user_name}\n\n"
            f"Previous chat:\n{history_text}\n\n"
            f"User: {transcript}\n"
            "Bot:"
        )

