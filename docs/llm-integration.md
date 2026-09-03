# Family Health LLM real-time record assistant

Family Health LLM uses a server-side adapter at `POST /v1/assistant/chat/stream`. It sends an SSE stream of answer fragments to the mobile client. The mobile app contains only the public API origin; it never receives LLM credentials or a model-service URL.

## Default provider: free local Ollama

The default adapter calls a locally hosted Ollama model. Install [Ollama](https://ollama.com/download) on the API host, then pull the default model:

```powershell
ollama pull llama3.2:3b
ollama serve
```

Set the non-secret configuration in the API host environment:

```powershell
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:OLLAMA_MODEL = "llama3.2:3b"
```

The API never logs prompts or responses. The model receives only the selected member label, documented allergy labels, extracted medication names, and the current question. No raw prescription bytes are sent to the model.

## Safety boundaries

- The system prompt prohibits diagnosis, prescribing, dose calculation, and medication-change instructions.
- Emergency-language queries bypass the model and direct the user to local emergency services.
- The assistant must mention uncertainty and qualified clinician/pharmacist review.
- A streamed answer is an explanation of record facts, never a safety clearance.
- For real deployment, retain prompts/responses only under documented consent, retention, encryption, and audit policies.

## Managed-provider migration

`OllamaAssistant` is isolated in [`llm.py`](../apps/api/src/family_health_llm/llm.py). A hosted provider can implement its `stream_reply(question, context)` contract. Keep provider credentials in the deployment secret manager or GitHub Actions secrets—never in the mobile app, `.env.example`, source, media, or logs.

Microsoft Foundry deployment has not been configured because this machine has no Azure Developer CLI and no Foundry project context. Follow the official [Foundry deployment guide](https://learn.microsoft.com/azure/ai-foundry/) once an Azure subscription, region, data-processing agreement, and production privacy review are available.
