export type FamilyMember = {
  id: string;
  display_name: string;
  relationship: string;
};

export type SafetyAlert = {
  id: string;
  severity: 'critical' | 'high' | 'moderate' | 'informational';
  title: string;
  explanation: string;
  evidence_source: string;
  recommended_action: string;
  medication_names: string[];
};

export type SafetyResponse = {
  alerts: SafetyAlert[];
  disclaimer: string;
};

type StreamEvent = {
  event: string;
  data: Record<string, string>;
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, init);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(error.detail ?? 'The service could not complete this request.');
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function getFamilyMembers(): Promise<FamilyMember[]> {
  return request<FamilyMember[]>('/v1/family-members');
}

export function createFamilyMember(
  displayName: string,
  relationship: string,
): Promise<FamilyMember> {
  return request<FamilyMember>('/v1/family-members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName, relationship }),
  });
}

export function createAllergy(memberId: string, substance: string): Promise<void> {
  return request<void>(`/v1/family-members/${memberId}/allergies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      substance,
      reaction: 'Reported by family; needs clinical confirmation',
    }),
  });
}

export async function uploadPrescription(memberId: string, uri: string): Promise<void> {
  const imageResponse = await fetch(uri);
  const imageBlob = await imageResponse.blob();
  const formData = new FormData();
  formData.append('document', imageBlob, 'prescription.jpg');
  await request(`/v1/prescriptions/extract?member_id=${memberId}`, {
    method: 'POST',
    body: formData,
  });
}

export function checkMedicationSafety(
  memberId: string,
  medicationName: string,
): Promise<SafetyResponse> {
  return request<SafetyResponse>('/v1/safety/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      member_id: memberId,
      medications: [{ name: medicationName }],
    }),
  });
}

export async function streamRecordAssistantReply(
  memberId: string,
  question: string,
  onDelta: (content: string) => void,
): Promise<void> {
  const response = await fetch(`${apiUrl}/v1/assistant/chat/stream`, {
    method: 'POST',
    headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
    body: JSON.stringify({ member_id: memberId, question }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(error.detail ?? 'The assistant could not start this request.');
  }
  if (!response.body) {
    throw new ApiError('This device does not support streamed assistant responses.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  while (true) {
    const next = await reader.read();
    if (next.done) {
      return;
    }
    pending += decoder.decode(next.value, { stream: true });
    const events = pending.split('\n\n');
    pending = events.pop() ?? '';
    for (const rawEvent of events) {
      const event = parseStreamEvent(rawEvent);
      if (event.event === 'delta' && event.data.content) {
        onDelta(event.data.content);
      }
      if (event.event === 'error') {
        throw new ApiError(event.data.message ?? 'The assistant could not complete this request.');
      }
    }
  }
}

function parseStreamEvent(rawEvent: string): StreamEvent {
  const event = rawEvent.match(/^event: (.+)$/m)?.[1] ?? 'message';
  const rawData = rawEvent.match(/^data: (.+)$/m)?.[1] ?? '{}';
  try {
    return { event, data: JSON.parse(rawData) as Record<string, string> };
  } catch {
    throw new ApiError('The assistant returned an unreadable response.');
  }
}
