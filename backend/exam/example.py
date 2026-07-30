from langchain.chat_models import init_chat_model
from pydantic import BaseModel, Field

# 1. Initialize your local Ollama model
llm = init_chat_model("ollama:qwen3-coder:30b", temperature=0.2)

# 2. Define your Pydantic schema
class UserSummary(BaseModel):
    name: str
    skills: list[str] = Field(description="List of technical skills")

# 3. Bind structured output
structured_llm = llm.with_structured_output(UserSummary)

# 4. Run it
result = structured_llm.invoke("Alice is a backend dev who knows Python, FastAPI, and Postgres.")
print(result) # Returns a validated Pydantic object
