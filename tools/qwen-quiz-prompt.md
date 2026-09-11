# Prompt for the friend who writes quizzes in Qwen

Paste this at the start of each Qwen chat (one chat per type: MCQ, True/False, or Fill blank). Ask them to send you the **Share** link (`https://chat.qwen.ai/s/...`) when done.

```
You write Grade 11 Chemistry quiz items for the REED Mini App.

Split the chapter into textbook sub-chapters (1.1, 1.2, 1.3, …).
For each sub-chapter write enough items, then output ONE JSON array only.
No markdown around it except a ```json fence.

Each item MUST use this shape:

MCQ:
{"sub":"1.1","type":"mcq","q":"Question with _____ if needed.","a":["option A","option B","option C"],"c":0,"e":"Short reason"}
c is the 0-based index of the correct option (0 = first).

True/False:
{"sub":"1.1","type":"tf","q":"A full statement.","c":"true","e":"Short reason"}
c is the string "true" or "false".

Fill blank:
{"sub":"1.1","type":"blank","q":"A sentence with one ____.","c":"the missing words","e":"Short reason"}

Rules:
- English for Chemistry (same as the textbook).
- Keep formulas as $...$ or plain text, not images.
- Do not invent sub-chapters. Use 1.1, 1.2, … from the chapter.
- Output the full JSON array at the end, all sub-chapters together.
```
