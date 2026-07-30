from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.exam.defense_chatbot import call_model
from backend.shared.schemas import MessageSchema

app = FastAPI()

# The web frontend is served from a different origin (a static file server, or
# opened straight from disk), so the browser needs CORS permission before it is
# allowed to POST to /call_model. This is a permissive, development-only policy.
allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"Hello": "World"}


# # The Schema that gets passed back and forth between calls.
# class MessageSchema(BaseModel):
#     user_input: str = ""
#     messages: List[Tuple[str, str]] = Field(default_factory=list)
#     recent_metadata: Dict[str, Any] = Field(default_factory=dict)

@app.post("/call_model")
def read_item(state: MessageSchema):
    state = call_model(state)
    return state
