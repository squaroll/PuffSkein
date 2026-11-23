const form = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const aiResponse = document.getElementById("ai-response");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = userInput.value.trim();

    if (!message || sendButton.disabled) {
        return;
    }

    sendButton.disabled = true;
    aiResponse.textContent = "正在思考……";

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error(`请求失败，状态码：${response.status}`);
        }

        if (!response.body) {
            throw new Error("浏览器未提供响应流");
        }

        const reader = response.body
            .pipeThrough(new TextDecoderStream())
            .getReader();

        aiResponse.textContent = "";

        try {
            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    break;
                }

                aiResponse.append(document.createTextNode(value));
            }
        } finally {
            reader.releaseLock();
        }
    } catch (error) {
        aiResponse.append(
            document.createTextNode(`\n发送失败：${error.message}`)
        );
    } finally {
        sendButton.disabled = false;
    }
});