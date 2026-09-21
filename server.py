from flask import Flask, request, jsonify
from agent import chat_with_agent

app = Flask(__name__, static_folder="static", static_url_path="")

# 访问根目录（即：http://127.0.0.1:5000/）时，返回并显示主页页面
@app.route("/")
def home():
    return app.send_static_file("index.html")

# 访问 /chat 子路径（即：http://127.0.0.1:5000/chat/）时，
# 获取用户输入信息发送给llm，并获取返回的结果
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data["message"]
    print("收到用户消息：", user_message)

    result = chat_with_agent(user_message)

    return jsonify({
        "reply": result
    })



if __name__ == "__main__":
    app.run(debug=True)