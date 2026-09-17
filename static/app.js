const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const aiResponse = document.getElementById("ai-response");

sendButton.addEventListener("click", async () => {
    const input = userInput.value;
    // 发送给ai
    const response = await fetch("/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: input
        })
    })
    const data = await response.json();

    const unsafeHtml = marked.parse(data.reply);
    aiResponse.innerHTML = DOMPurify.sanitize(unsafeHtml);
})
