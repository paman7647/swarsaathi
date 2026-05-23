import re
from typing import Any


NAME_PATTERNS = (
    re.compile(
        r"\b(?:my name is|i am|i'm|mera naam|mera name|naa peru)\s+([\w\u0900-\u097f\u0c00-\u0c7f'-]{2,40})",
        re.I,
    ),
    re.compile(
        r"(?:నా పేరు|मेरा नाम)\s+([\w\u0900-\u097f\u0c00-\u0c7f'-]{2,40})",
        re.I,
    ),
)


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_name(text: str) -> str | None:
    for pattern in NAME_PATTERNS:
        match = pattern.search(text)
        if match:
            candidate = match.group(1).strip(" .,!?")
            return candidate[:1].upper() + candidate[1:] if candidate.isascii() else candidate
    return None


def detect_intent(text: str) -> str:
    lowered = text.casefold()
    
    # Exact word-boundary patterns for English/Latin terms to avoid false positives (e.g. 'this' matching 'hi')
    english_intents = {
        "demo": [r"\bdemo\b", r"\btrial\b"],
        "pricing": [r"\bprice\b", r"\bpricing\b", r"\bcost\b", r"\bplan\b"],
        "support": [r"\bhelp\b", r"\bsupport\b", r"\bissue\b", r"\bproblem\b", r"\bbug\b", r"\berror\b"],
        "scheduling": [r"\bschedule\b", r"\bmeeting\b", r"\btomorrow\b", r"\btoday\b", r"\bcalendar\b", r"\bbook\b"],
        "greeting": [r"\bhello\b", r"\bhi\b", r"\bnamaste\b", r"\bnamaskar\b", r"\bhey\b"],
    }
    
    # Simple substring patterns for Hindi/Telugu specific terms
    indian_substrings = {
        "demo": ("डेमो", "డెమో"),
        "pricing": ("kitna", "ధర", "ధరలు", "पैसा"),
        "support": ("सपोर्ट", "సమస్య"),
        "scheduling": ("సమయం", "समय"),
        "greeting": ("नमस्ते", "నమస్తే"),
    }
    
    for intent in english_intents:
        for pattern in english_intents[intent]:
            if re.search(pattern, lowered):
                return intent
                
    for intent, terms in indian_substrings.items():
        if any(term in lowered for term in terms):
            return intent
            
    return "general"


def updated_memory(memory: dict[str, Any], transcript: str) -> dict[str, Any]:
    next_memory = dict(memory)
    name = extract_name(transcript)
    if name:
        next_memory["user_name"] = name
    next_memory["last_intent"] = detect_intent(transcript)
    return next_memory


def detect_language(text: str) -> str:
    # 1. Regex check for Telugu script characters
    if re.search(r"[\u0c00-\u0c7f]", text):
        return "telugu"
    # 2. Regex check for Hindi Devanagari script characters
    if re.search(r"[\u0900-\u097f]", text):
        return "hindi"
    
    # 3. Fallback check for Romanized Indian scripts vs standard English keywords
    lowered = text.casefold()
    telugu_roman_keywords = ("peru", "kavali", "chestanu", "cheppandi", "cheddam", "undichandi", "dhara", "samayam", "sahayam", "meeku", "naa", "andi")
    hindi_roman_keywords = ("mera", "naam", "chahiye", "kitna", "bata", "karna", "samajh", "aapko", "hai", "mujhe", "ek")
    
    if any(word in lowered for word in telugu_roman_keywords):
        return "telugu"
    if any(word in lowered for word in hindi_roman_keywords):
        return "hindi"

    # 4. If common English words are present, classify as English
    english_keywords = ("my", "name", "is", "need", "demo", "price", "cost", "pricing", "plan", "support", "help", "meeting", "schedule", "hello", "hi", "hey", "how", "what", "can", "you", "who")
    if any(word in lowered for word in english_keywords):
        return "english"
        
    return "english"  # Default fallback if mixed or unsure


def local_reply(transcript: str, memory: dict[str, Any], response_script: str = "roman") -> str:
    intent = memory.get("last_intent", "general")
    name = memory.get("user_name")
    
    # Detect query language
    lang = detect_language(transcript)
    
    # Establish honorifics naturally by language and script
    if name:
        if lang == "telugu":
            salutation = f"{name} garu, " if response_script == "roman" else f"{name} గారు, "
        elif lang == "hindi":
            salutation = f"{name} ji, " if response_script == "roman" else f"{name} जी, "
        else:
            salutation = f"{name}, " # Natural for English
    else:
        salutation = ""

    # Grammatically correct dictionary mapping (by intent, language, and script)
    replies = {
        "greeting": {
            "hindi": {
                "native": f"नमस्ते {salutation}आपको क्या सहायता चाहिए?",
                "roman": f"Namaste {salutation}aapko kya help chahiye?"
            },
            "telugu": {
                "native": f"నమస్తే {salutation}మీకు ఏమి సహాయం కావాలి?",
                "roman": f"Namaste {salutation}meeku emi sahayam kavali?"
            },
            "english": {
                "native": f"Hello {salutation}how can I help you?",
                "roman": f"Hello {salutation}how can I help you?"
            }
        },
        "demo": {
            "hindi": {
                "native": f"ज़रूर {salutation}मैं आपके लिए डेमो शेड्यूल कर देता हूँ।",
                "roman": f"Sure {salutation}main aapke liye demo schedule kar deta hoon."
            },
            "telugu": {
                "native": f"తప్పకుండా {salutation}నేను మీకు డెమో షెడ్యూల్ చేస్తాను.",
                "roman": f"Sure {salutation}nenu meeku demo schedule chestanu."
            },
            "english": {
                "native": f"Sure {salutation}I will schedule a software demo for you.",
                "roman": f"Sure {salutation}I will schedule a software demo for you."
            }
        },
        "pricing": {
            "hindi": {
                "native": f"{salutation}प्राइसिंग डिटेल्स बता देता हूँ। कृपया अपनी आवश्यकताएं साझा करें।",
                "roman": f"{salutation}pricing details bata deta hoon. Kripya apni requirements share karein."
            },
            "telugu": {
                "native": f"{salutation}ధరల వివరాలు చెప్తాను. మీ అవసరాలు కొంచెం షేర్ చేయండి.",
                "roman": f"{salutation}pricing details cheptanu. Mee requirements konchem share cheyandi."
            },
            "english": {
                "native": f"{salutation}I will share the pricing details. Please let me know your requirements.",
                "roman": f"{salutation}I will share the pricing details. Please let me know your requirements."
            }
        },
        "support": {
            "hindi": {
                "native": f"ज़रूर {salutation}मैं आपकी मदद करूँगा। क्या समस्या है बताइए?",
                "roman": f"Sure {salutation}main aapki help karunga. Kya problem hai bataiye?"
            },
            "telugu": {
                "native": f"తప్పకుండా {salutation}నేను మీకు సహాయం చేస్తాను. ఏమి సమస్య ఉందో చెప్పండి.",
                "roman": f"Sure {salutation}nenu meeku help chestanu. Emi samasya undo cheppandi."
            },
            "english": {
                "native": f"Sure {salutation}I will help you. Please describe the support you need.",
                "roman": f"Sure {salutation}I will help you. Please describe the support you need."
            }
        },
        "scheduling": {
            "hindi": {
                "native": f"हो गया {salutation}डेमो शेड्यूल करते हैं। अपना पसंदीदा समय बताइए।",
                "roman": f"Done {salutation}demo schedule karte hain. Apna preferred time bataiye."
            },
            "telugu": {
                "native": f"అయిపోయింది {salutation}డెమో షెడ్యూల్ చేద్దాం. మీ కన్వీనియంట్ టైమ్ చెప్పండి.",
                "roman": f"Done {salutation}demo schedule cheddam. Mee convenient time cheppandi."
            },
            "english": {
                "native": f"Done {salutation}let us schedule the demo. Please share your convenient time.",
                "roman": f"Done {salutation}let us schedule the demo. Please share your convenient time."
            }
        },
        "general": {
            "hindi": {
                "native": f"{salutation}समझ गया। डेमो, हेल्प, या प्राइसिंग में से क्या चाहिए?",
                "roman": f"{salutation}samajh gaya. Demo, help, ya pricing mein se kya chahiye?"
            },
            "telugu": {
                "native": f"{salutation}అర్థమైంది. డెమో, హెల్ప్, లేదా ప్రైసింగ్‌ లో ఏమి కావాలి?",
                "roman": f"{salutation}ardham ayyindi. Demo, help, leda pricing lo emi kavali?"
            },
            "english": {
                "native": f"{salutation}Understood. Would you like a demo, support, or pricing?",
                "roman": f"{salutation}Understood. Would you like a demo, support, or pricing?"
            }
        }
    }

    # Extract the correct reply based on parameters
    intent_replies = replies.get(intent, replies["general"])
    lang_replies = intent_replies.get(lang, intent_replies["hindi"])
    reply = lang_replies.get(response_script, lang_replies["roman"])
    
    # Fallback to greeting if name was just extracted
    if extract_name(transcript) and intent == "general":
        greeting_lang = replies["greeting"].get(lang, replies["greeting"]["hindi"])
        reply = greeting_lang.get(response_script, greeting_lang["roman"])
        
    return reply



