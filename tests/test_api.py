import json
import unittest
from unittest.mock import patch
from uuid import uuid4

import httpx

from puffskein import api


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_ndjson_events_and_request_options(self):
        calls = []

        async def chat(message, thread_id, allow_search, timezone):
            calls.append((message, thread_id, allow_search, timezone))
            yield {"type": "status", "status": "thinking"}
            yield {"type": "text", "text": "你好\nReact"}
            yield {"type": "done"}

        thread_id = str(uuid4())
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url="http://test") as client:
            with patch.object(api, "chat", chat):
                response = await client.post("/chat", json={
                    "message": "你好", "thread_id": thread_id, "allow_search": False, "timezone": "Europe/Paris",
                })
            self.assertEqual(response.status_code, 200)
            self.assertIn("application/x-ndjson", response.headers["content-type"])
            self.assertEqual(response.headers["x-accel-buffering"], "no")
            events = [json.loads(line) for line in response.text.splitlines()]
            self.assertEqual(events[1]["text"], "你好\nReact")
            self.assertEqual(events[-1]["type"], "done")
            self.assertEqual(calls, [("你好", thread_id, False, "Europe/Paris")])
            for payload in [
                {}, {"message": ""}, {"message": "hi", "thread_id": "invalid"},
                {"message": "hi", "timezone": "Invalid/Timezone"},
            ]:
                self.assertEqual((await client.post("/chat", json=payload)).status_code, 422)


if __name__ == "__main__":
    unittest.main()
