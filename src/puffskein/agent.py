from dotenv import load_dotenv

from langchain.chat_models import init_chat_model
from langchain.messages import HumanMessage, SystemMessage

load_dotenv()

model = init_chat_model(
    "deepseek:deepseek-flash"
)

systemMessage = "你是PuffSkein个人日常工作台内置的AI助手，可以进行日常对话、完成多项任务、进行娱乐互动"

def chat(question: str) -> str:
    messages = [
        SystemMessage(content=systemMessage),
        HumanMessage(content=question)
    ]

    for chunk in model.stream(messages):
        if chunk.content:
            yield chunk.content