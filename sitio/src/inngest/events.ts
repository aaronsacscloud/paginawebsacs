// Event schemas for Inngest. All events agent-related.

export type AgentEvents = {
  'agent/hello.requested': {
    data: {
      contact_id?: string;
      owner_id?: string;
      message?: string;
    };
  };
  'agent/meeting-prep.requested': {
    data: {
      meeting_id: string;
      contact_id: string;
      owner_id?: string;          // partner asignado (recibe el brief)
      company_id?: string;
      scheduled_at: string;
    };
  };
  'agent/quote-drafter.requested': {
    data: {
      transcript: string;
      contact_id?: string;
      company_id?: string;
      owner_id?: string;          // partner que sube el transcript
      deal_id?: string;
    };
  };
  'agent/service-recommender.requested': {
    data: {
      quote_id: string;
      owner_id?: string;
    };
  };
};
