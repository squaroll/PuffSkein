from flask import Flask, request, jsonify
from agent import chat_with_agent

app = Flask(__name__, static_folder="static", static_url_path="")

@app.route("/")
def home():
    return app.send_static_file("index.html")

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