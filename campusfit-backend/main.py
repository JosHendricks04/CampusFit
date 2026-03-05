from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import os

# 🚨 NEW: Library to read your hidden .env file
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# --- 1. SETUP API KEY ---
# This looks for the .env file in the same folder as this script
load_dotenv()

# We pull the key from the environment instead of hardcoding it
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Make sure LangChain knows which key to use
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

# --- 2. DEFINE THE STRUCTURED OUTPUTS (THE TOOLS) ---
class Exercise(BaseModel):
    name: str = Field(description="Name of the exercise (e.g., 'Squat (Barbell)')")
    category: str = Field(description="Primary muscle group (e.g., 'Chest', 'Back', 'Legs', 'Arms', 'Shoulders', 'Core', 'Full Body')")
    sets: int = Field(description="Number of sets")
    reps: str = Field(description="Target reps (e.g., '10' or '8-12')")

class WorkoutDay(BaseModel):
    day_name: str = Field(description="e.g., 'Day 1: Heavy Legs' or 'Push Day'")
    focus: str = Field(description="Main muscle group or motor pattern focus")
    exercises: List[Exercise]

class WorkoutPlan(BaseModel):
    plan_name: str = Field(description="Short, catchy name for the plan (Max 3 words)")
    goal: str = Field(description="The user's primary goal")
    description: str = Field(description="A brief explanation of why this routine fits their goal")
    schedule: List[WorkoutDay]

class ColorResponse(BaseModel):
    primary: str = Field(description="The primary brand hex color (e.g., #00274C for Michigan Blue)")
    secondary: str = Field(description="The secondary brand hex color (e.g., #FFCB05 for Michigan Maize)")

# --- 3. INITIALIZE LANGCHAIN ---
# Note: Ensure you have access to gemini-2.0-flash or the latest available model
llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.2)
llm_with_tools = llm.bind_tools([WorkoutPlan])
llm_colors = llm.with_structured_output(ColorResponse)

SYSTEM_PROMPT = """You are 'Coach AI', a highly scientific sports science coach with a Ph.D. in Kinesiology, working for the CampusFit app.
Your job is to optimize the user's performance using evidence-based principles.

RULES:
1. You have two modes: Answering Questions AND Building Workouts.
2. IF THE USER ASKS A QUESTION: Be extremely concise. Give a short, punchy summary (1-2 sentences) or a brief bulleted list of the main points. Always end by asking, "Would you like me to explain the science behind this in more detail?"
3. IF THE USER ASKS FOR A WORKOUT: You must use the WorkoutPlan tool to generate the routine.
4. Before generating a workout, you must know their: Primary Goal, Days Per Week, and Available Equipment.
5. Always maintain a professional, analytical, and encouraging tone.
"""

# --- 4. FASTAPI SETUP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str 
    text: str = ""

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ColorRequest(BaseModel):
    school_name: str

# --- 5. THE API ENDPOINTS ---

@app.post("/get_school_color")
async def get_school_color(request: ColorRequest):
    try:
        prompt = f"What are the official primary and secondary brand hex colors for '{request.school_name}'? Be exact."
        color_data = llm_colors.invoke([HumanMessage(content=prompt)])
        return {"primary": color_data.primary, "secondary": color_data.secondary}
    except Exception as e:
        print(f"Color Error: {e}")
        return {"primary": "#000000", "secondary": "#007AFF"} 

@app.post("/chat")
async def chat_with_coach(request: ChatRequest):
    langchain_messages = [SystemMessage(content=SYSTEM_PROMPT)]
    
    for msg in request.messages:
        safe_text = str(msg.text)
        if msg.role == "user":
            langchain_messages.append(HumanMessage(content=safe_text))
        elif msg.role == "ai":
            langchain_messages.append(AIMessage(content=safe_text))

    response = llm_with_tools.invoke(langchain_messages)

    if response.tool_calls:
        tool_call = response.tool_calls[0]
        workout_data = tool_call["args"]
        
        return {
            "text": "I've put together a routine based on your goals. Save it to your templates if you like it!",
            "workoutPlan": workout_data
        }
    else:
        content = response.content
        if isinstance(content, list):
            safe_response = " ".join([str(block.get("text", "")) for block in content if isinstance(block, dict) and "text" in block])
        else:
            safe_response = str(content)

        return {
            "text": safe_response,
            "workoutPlan": None
        }