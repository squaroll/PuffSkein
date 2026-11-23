from dotenv import load_dotenv

from langchain.chat_models import init_chat_model
from langchain.messages import HumanMessage, SystemMessage

load_dotenv()

model = init_chat_model(
    "deepseek:deepseek-flash"
)

systemMessage = "你是一个AI编程助手"

def chat(question: str) -> str:
    messages = [
        SystemMessage(content=systemMessage),
        HumanMessage(content=question)
    ]

    for chunk in model.stream(messages):
        if chunk.content:
            yield chunk.content