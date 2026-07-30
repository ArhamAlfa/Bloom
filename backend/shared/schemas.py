from pydantic import BaseModel, Field
from typing import List, Tuple, Any, Dict

# The Schema that gets passed back and forth between calls.
class MessageSchema(BaseModel):
    user_input: str = ""
    # The subtopic being defended (e.g. "Electric fields"). The frontend sends
    # it so the examiner can challenge on whatever subject was opened, instead
    # of a hard-coded one. Only read when seeding a fresh conversation.
    topic: str = ""
    messages: List[Tuple[str, str]] = Field(default_factory=list)
    recent_metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "user_input": "Help me with my physics homework",
                    "topic": "Gravitational fields",
                    "messages": "[(\"system\", \"You are a helpful chatbot\"), "
                    "(\"user\", \"Hello\"), "
                    "(\"System\", \"Hi, I'm a helpful chatbot.\")]",
                    "recent_metadata": {"Tokens_used": 1434}
                }
            ]
        }
    }