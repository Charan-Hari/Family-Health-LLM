# Family Health LLM local MCP server

The Family Health LLM MCP server is a **local stdio development tool**, not a public web service. It proxies three narrow API operations:

| Tool | Purpose |
|---|---|
| `list_prescription_extractions` | List review-required medication extraction candidates |
| `screen_medication` | Run the curated advisory medication-safety screen |
| `explain_member_record` | Stream a bounded, advisory explanation from the local record assistant |

## Run locally

Start the Family Health LLM API and local Ollama model first. Then:

```powershell
cd C:\path\to\Family-Health-LLM\apps\mcp-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
family-health-llm-mcp
```

If your API is not at `http://127.0.0.1:8000`, set the non-secret `FAMILY_HEALTH_LLM_API_URL` environment variable before starting the MCP server.

## Client configuration

Install the MCP package as above, then configure your MCP client to use the project command:

```json
{
  "mcpServers": {
    "family-health-llm-local": {
      "command": "C:\\path\\to\\Family-Health-LLM\\apps\\mcp-server\\.venv\\Scripts\\family-health-llm-mcp.exe",
      "env": {
        "FAMILY_HEALTH_LLM_API_URL": "http://127.0.0.1:8000"
      }
    }
  }
}
```

The API URL is configuration, not a credential. Never configure the MCP server against an unauthenticated public health-record API. Before using it with actual health data, add enforced user authentication, tenant authorization, consent, audit, encryption, and clinical governance.

## Verify

```powershell
cd C:\path\to\Family-Health-LLM\apps\mcp-server
python -m pytest
python -m ruff check .
```
